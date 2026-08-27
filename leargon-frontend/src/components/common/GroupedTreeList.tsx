import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChevronRight, ExpandMore, UnfoldLess, UnfoldMore } from '@mui/icons-material';
import { useGetGroupedOverview } from '../../api/generated/overview/overview';
import { useLocale } from '../../context/LocaleContext';
import { containsKey, resolveGroupOpen } from '../../utils/groupExpansion';
import type {
  GroupedOverviewResponse,
  OverviewGroup,
  OverviewNode,
  OverviewResourceType,
} from '../../api/generated/model';

interface GroupedTreeListProps {
  resourceType: OverviewResourceType;
  groupBy: string;
  selectedKey?: string;
  filter: string;
  icon: React.ReactNode;
  onSelect: (key: string) => void;
  /** Shown when the list has no items at all, so each page can name its own empty state. */
  emptyLabel: string;
}

/**
 * An overview list rendered in groups.
 *
 * Each group keeps the sub-trees of its members rather than flattening them, so an item stays where
 * the reader expects to find it. An ancestor that is only present to give a member its place — the
 * parent belongs to a different owner, team or context — arrives with `matchesGroup: false` and is
 * shown greyed out and unselectable: it is there for orientation, and clicking it would navigate to
 * something the group does not actually contain.
 *
 * Groups start closed, so the panel opens as a short list of headings with counts instead of a list
 * longer than the ungrouped one it replaced. `resolveGroupOpen` owns the exceptions to that.
 */
const GroupedTreeList: React.FC<GroupedTreeListProps> = ({
  resourceType,
  groupBy,
  selectedKey,
  filter,
  icon,
  onSelect,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { data: response, isLoading } = useGetGroupedOverview(resourceType, { groupBy });
  const groups = (response?.data as GroupedOverviewResponse | undefined)?.groups ?? [];

  const matchesFilter = (node: OverviewNode): boolean => {
    if (!filter) return true;
    if (getLocalizedText(node.names, node.key).toLowerCase().includes(filter.toLowerCase())) return true;
    return node.children.some(matchesFilter);
  };

  // A group whose every item is filtered out is dropped, rather than left as an empty heading.
  const visibleGroups = groups
    .map((group) => ({ group, nodes: group.nodes.filter(matchesFilter) }))
    .filter(({ nodes }) => nodes.length > 0);

  // Only headings the user has actually clicked appear here; everything else is derived, so there is
  // no stored state to fall out of step with the data.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // A group closed earlier must not stay closed through a later search and hide a match from it.
  // Clearing on a groupBy change likewise means a new dimension starts from the default.
  useEffect(() => setOverrides({}), [filter, groupBy]);

  const groupId = (group: OverviewGroup): string => group.key ?? '__unassigned';

  const headingFor = (group: OverviewGroup): string => {
    const fallback = getLocalizedText(group.labels, group.key ?? '');
    // An enum value or the unassigned bucket names an i18n key the UI already translates; user content
    // arrives translated and has no key.
    return group.labelKey ? t(group.labelKey, { defaultValue: fallback }) : fallback;
  };

  const openById = useMemo(() => {
    const resolved: Record<string, boolean> = {};
    visibleGroups.forEach(({ group, nodes }) => {
      resolved[groupId(group)] = resolveGroupOpen({
        override: overrides[groupId(group)],
        isFiltering: !!filter,
        groupCount: visibleGroups.length,
        containsSelection: containsKey(nodes, selectedKey),
      });
    });
    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGroups, overrides, filter, selectedKey]);

  const allOpen = visibleGroups.every(({ group }) => openById[groupId(group)]);

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    visibleGroups.forEach(({ group }) => {
      next[groupId(group)] = !allOpen;
    });
    setOverrides(next);
  };

  if (isLoading) {
    return <Typography sx={{ color: 'text.secondary', p: 2 }}>{t('common.loading')}</Typography>;
  }

  if (visibleGroups.length === 0) {
    return (
      <Typography sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
        {filter ? t('common.noMatches') : emptyLabel}
      </Typography>
    );
  }

  return (
    <>
      {/* Pointless with a single group, which is always open anyway. */}
      {visibleGroups.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, py: 0.5 }}>
          <Button
            size="small"
            startIcon={allOpen ? <UnfoldLess fontSize="small" /> : <UnfoldMore fontSize="small" />}
            onClick={toggleAll}
            sx={{ fontSize: '0.7rem' }}
          >
            {allOpen ? t('groupBy.collapseAll') : t('groupBy.expandAll')}
          </Button>
        </Box>
      )}
      {visibleGroups.map(({ group, nodes }) => {
        const id = groupId(group);
        const open = openById[id];
        const heading = headingFor(group);
        return (
          <Box key={id} sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => setOverrides((prev) => ({ ...prev, [id]: !open }))}
              aria-expanded={open}
              aria-label={t(open ? 'groupBy.collapseGroup' : 'groupBy.expandGroup', { group: heading })}
              sx={{ px: 2, py: 0.75, bgcolor: 'action.hover' }}
            >
              {open ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              <Typography
                variant="caption"
                sx={{
                  ml: 0.5,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  // The list panel is only 240px wide on a normal screen, so a long unit name wraps
                  // rather than being cut off.
                  wordBreak: 'break-word',
                }}
              >
                {heading} ({group.itemCount})
              </Typography>
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <List dense disablePadding>
                {nodes.map((node) => (
                  <GroupedTreeItem
                    key={node.key}
                    node={node}
                    level={0}
                    selectedKey={selectedKey}
                    filter={filter}
                    icon={icon}
                    onSelect={onSelect}
                    matchesFilter={matchesFilter}
                  />
                ))}
              </List>
            </Collapse>
          </Box>
        );
      })}
    </>
  );
};

interface GroupedTreeItemProps {
  node: OverviewNode;
  level: number;
  selectedKey?: string;
  filter: string;
  icon: React.ReactNode;
  onSelect: (key: string) => void;
  matchesFilter: (node: OverviewNode) => boolean;
}

const GroupedTreeItem: React.FC<GroupedTreeItemProps> = ({
  node,
  level,
  selectedKey,
  filter,
  icon,
  onSelect,
  matchesFilter,
}) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  // A context ancestor is collapsed shut by default only when it has nothing to show; otherwise the
  // member underneath it would be hidden behind a chevron, defeating the point of showing the branch.
  const [open, setOpen] = useState(true);
  const children = node.children.filter(matchesFilter);
  const hasChildren = children.length > 0;
  const isSelected = node.key === selectedKey;
  const name = getLocalizedText(node.names, node.key);

  const row = (
    <ListItemButton
      selected={isSelected}
      disabled={!node.matchesGroup}
      onClick={() => node.matchesGroup && onSelect(node.key)}
      sx={{ pl: 1 + level * 2 }}
    >
      {hasChildren ? (
        <ListItemIcon
          sx={{ minWidth: 24, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {open ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
        </ListItemIcon>
      ) : (
        <ListItemIcon sx={{ minWidth: 24 }} />
      )}
      <ListItemIcon sx={{ minWidth: 28 }}>{icon}</ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: isSelected ? 600 : 400,
              fontStyle: node.matchesGroup ? 'normal' : 'italic',
              color: node.matchesGroup ? 'text.primary' : 'text.disabled',
            }}
          >
            {name}
          </Typography>
        }
      />
    </ListItemButton>
  );

  return (
    <>
      {node.matchesGroup ? (
        row
      ) : (
        // `disabled` swallows the pointer events a Tooltip listens for, so the wrapper carries them.
        <Tooltip title={t('groupBy.contextOnly')} placement="right">
          <span>{row}</span>
        </Tooltip>
      )}
      {hasChildren && (
        <Collapse in={open || !!filter} timeout="auto" unmountOnExit>
          <List dense disablePadding>
            {children.map((child) => (
              <GroupedTreeItem
                key={child.key}
                node={child}
                level={level + 1}
                selectedKey={selectedKey}
                filter={filter}
                icon={icon}
                onSelect={onSelect}
                matchesFilter={matchesFilter}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default GroupedTreeList;
