declare module 'bpmn-js/lib/Modeler' {
  export default class BpmnModeler {
    constructor(options: { container: HTMLElement; [key: string]: unknown });
    importXML(xml: string): Promise<{ warnings: string[] }>;
    saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
    destroy(): void;
  }
}

declare module 'bpmn-js/lib/NavigatedViewer' {
  export default class BpmnNavigatedViewer {
    constructor(options: { container: HTMLElement; [key: string]: unknown });
    importXML(xml: string): Promise<{ warnings: string[] }>;
    destroy(): void;
  }
}
