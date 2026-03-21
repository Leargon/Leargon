/**
 * Pure XML utilities for inline SubProcess expansion/collapse in bpmn-js diagrams.
 *
 * Strategy:
 *  - A linked process key is stored in a bpmn:Documentation element on the SubProcess:
 *      <bpmn:documentation>leargon-lpk:some-process-key</bpmn:documentation>
 *  - When expanding: child process elements are embedded with prefixed IDs (subProcessId$childId)
 *    and child DI shapes are placed inside the SubProcess bounds with coordinate offsets.
 *  - When collapsing: embedded elements (those whose ID starts with subProcessId$) are stripped.
 */

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';

export const LPK_PREFIX = 'leargon-lpk:';
const ID_SEP = '$';

const EXPANDED_W = 420;
const EXPANDED_H = 220;
const COLLAPSED_W = 100;
const COLLAPSED_H = 80;
const PADDING = 30;

// ─── helpers ─────────────────────────────────────────────────────────────────

function findByAttr(
  doc: Document,
  ns: string,
  localName: string,
  attr: string,
  value: string,
): Element | null {
  const els = doc.getElementsByTagNameNS(ns, localName);
  for (let i = 0; i < els.length; i++) {
    if (els[i].getAttribute(attr) === value) return els[i];
  }
  return null;
}

/** Recursively prefix id and ID-reference attributes in an element sub-tree. */
function prefixIds(el: Element, prefix: string): void {
  const id = el.getAttribute('id');
  if (id) el.setAttribute('id', prefix + id);

  for (const refAttr of ['sourceRef', 'targetRef', 'attachedToRef', 'default', 'calledElement']) {
    const v = el.getAttribute(refAttr);
    if (v) el.setAttribute(refAttr, prefix + v);
  }

  for (const child of Array.from(el.children)) {
    prefixIds(child, prefix);
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Read the linked process key from a bpmn:SubProcess element's businessObject.
 * Checks calledElement first (set by the link dialog), then falls back to
 * bpmn:Documentation (legacy storage).
 * Works directly on the bpmn-js businessObject (not on XML strings).
 */
export function readLinkedProcessKeyFromBo(businessObject: {
  documentation?: Array<{ text?: string }>;
  calledElement?: string;
}): string | null {
  if (businessObject.calledElement) return businessObject.calledElement;
  const docs = businessObject.documentation ?? [];
  const match = docs.find((d) => d.text?.startsWith(LPK_PREFIX));
  return match?.text ? match.text.slice(LPK_PREFIX.length) : null;
}

/**
 * Embed the child process's content into the parent XML's SubProcess element and update DI.
 * Returns the merged XML string ready for re-import.
 */
export function expandSubProcessInXml(
  parentXml: string,
  childXml: string,
  subProcessId: string,
): string {
  const parser = new DOMParser();
  const parentDoc = parser.parseFromString(parentXml, 'text/xml');
  const childDoc = parser.parseFromString(childXml, 'text/xml');

  const pfx = subProcessId + ID_SEP;

  // ── Model level ──────────────────────────────────────────────────────────
  const subProcessEl = findByAttr(parentDoc, BPMN_NS, 'subProcess', 'id', subProcessId);
  if (!subProcessEl) return parentXml;
  subProcessEl.setAttribute('isExpanded', 'true');

  const childProcessEls = childDoc.getElementsByTagNameNS(BPMN_NS, 'process');
  if (childProcessEls.length > 0) {
    const childProcess = childProcessEls[0];
    for (const child of Array.from(childProcess.children)) {
      // Skip the child process's own documentation — we want ours to remain intact
      if (child.localName === 'documentation') continue;
      const clone = child.cloneNode(true) as Element;
      prefixIds(clone, pfx);
      subProcessEl.appendChild(parentDoc.adoptNode(clone));
    }
  }

  // ── DI level ─────────────────────────────────────────────────────────────
  const parentPlanes = parentDoc.getElementsByTagNameNS(BPMNDI_NS, 'BPMNPlane');
  if (parentPlanes.length === 0) return new XMLSerializer().serializeToString(parentDoc);
  const parentPlane = parentPlanes[0];

  // Find SubProcess DI shape, read its position, set expanded size
  const spShape = findByAttr(parentDoc, BPMNDI_NS, 'BPMNShape', 'bpmnElement', subProcessId);
  let spX = 100;
  let spY = 100;
  if (spShape) {
    const bounds = spShape.getElementsByTagNameNS(DC_NS, 'Bounds')[0];
    if (bounds) {
      spX = parseFloat(bounds.getAttribute('x') ?? '100');
      spY = parseFloat(bounds.getAttribute('y') ?? '100');
      bounds.setAttribute('width', String(EXPANDED_W));
      bounds.setAttribute('height', String(EXPANDED_H));
    }
    spShape.setAttribute('isExpanded', 'true');
  }

  // Copy child DI into parent plane, normalizing coordinates to fit inside SubProcess
  const childPlanes = childDoc.getElementsByTagNameNS(BPMNDI_NS, 'BPMNPlane');
  if (childPlanes.length > 0) {
    const childPlane = childPlanes[0];

    // Determine min x/y of child shapes to normalise their origin
    let minX = Infinity;
    let minY = Infinity;
    for (const shape of Array.from(childPlane.getElementsByTagNameNS(BPMNDI_NS, 'BPMNShape'))) {
      const b = shape.getElementsByTagNameNS(DC_NS, 'Bounds')[0];
      if (b) {
        minX = Math.min(minX, parseFloat(b.getAttribute('x') ?? '0'));
        minY = Math.min(minY, parseFloat(b.getAttribute('y') ?? '0'));
      }
    }
    if (!isFinite(minX)) minX = 0;
    if (!isFinite(minY)) minY = 0;

    const offsetX = spX + PADDING - minX;
    const offsetY = spY + PADDING - minY;

    // Shapes
    for (const shape of Array.from(childPlane.getElementsByTagNameNS(BPMNDI_NS, 'BPMNShape'))) {
      const clone = shape.cloneNode(true) as Element;
      const bpmnEl = clone.getAttribute('bpmnElement');
      if (bpmnEl) clone.setAttribute('bpmnElement', pfx + bpmnEl);
      const id = clone.getAttribute('id');
      if (id) clone.setAttribute('id', pfx + id);
      const b = clone.getElementsByTagNameNS(DC_NS, 'Bounds')[0];
      if (b) {
        b.setAttribute('x', String(parseFloat(b.getAttribute('x') ?? '0') + offsetX));
        b.setAttribute('y', String(parseFloat(b.getAttribute('y') ?? '0') + offsetY));
      }
      parentPlane.appendChild(parentDoc.adoptNode(clone));
    }

    // Edges
    for (const edge of Array.from(childPlane.getElementsByTagNameNS(BPMNDI_NS, 'BPMNEdge'))) {
      const clone = edge.cloneNode(true) as Element;
      const bpmnEl = clone.getAttribute('bpmnElement');
      if (bpmnEl) clone.setAttribute('bpmnElement', pfx + bpmnEl);
      const id = clone.getAttribute('id');
      if (id) clone.setAttribute('id', pfx + id);
      const waypoints = clone.getElementsByTagNameNS(DI_NS, 'waypoint');
      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        wp.setAttribute('x', String(parseFloat(wp.getAttribute('x') ?? '0') + offsetX));
        wp.setAttribute('y', String(parseFloat(wp.getAttribute('y') ?? '0') + offsetY));
      }
      parentPlane.appendChild(parentDoc.adoptNode(clone));
    }
  }

  return new XMLSerializer().serializeToString(parentDoc);
}

/**
 * Strip embedded sub-process content from the parent XML and reset the SubProcess to collapsed.
 * Removes all model elements and DI nodes whose IDs start with `subProcessId$`.
 */
export function collapseSubProcessInXml(parentXml: string, subProcessId: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(parentXml, 'text/xml');
  const pfx = subProcessId + ID_SEP;

  // Strip embedded model elements (keep documentation)
  const subProcessEl = findByAttr(doc, BPMN_NS, 'subProcess', 'id', subProcessId);
  if (subProcessEl) {
    subProcessEl.setAttribute('isExpanded', 'false');
    const toRemove = Array.from(subProcessEl.children).filter(
      (c) => c.localName !== 'documentation',
    );
    toRemove.forEach((c) => subProcessEl.removeChild(c));
  }

  // Strip embedded DI nodes and reset SubProcess shape size
  const plane = doc.getElementsByTagNameNS(BPMNDI_NS, 'BPMNPlane')[0];
  if (plane) {
    const toRemove: Element[] = [];
    for (const child of Array.from(plane.children)) {
      const bpmnEl = child.getAttribute('bpmnElement') ?? '';
      if (bpmnEl.startsWith(pfx)) toRemove.push(child);
    }
    toRemove.forEach((c) => plane.removeChild(c));

    const spShape = findByAttr(doc, BPMNDI_NS, 'BPMNShape', 'bpmnElement', subProcessId);
    if (spShape) {
      const b = spShape.getElementsByTagNameNS(DC_NS, 'Bounds')[0];
      if (b) {
        b.setAttribute('width', String(COLLAPSED_W));
        b.setAttribute('height', String(COLLAPSED_H));
      }
      spShape.setAttribute('isExpanded', 'false');
    }
  }

  return new XMLSerializer().serializeToString(doc);
}
