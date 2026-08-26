import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import GroupedTreeList from '../common/GroupedTreeList';
import { NO_GROUPING } from '../../hooks/useGroupByPreference';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Add, Search, ExpandMore, ChevronRight, AccountTree } from '@mui/icons-material';
import { useGetAllCapabilities } from '../../api/generated/capability/capability';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { canCreateRoot } from '../../utils/roles';
import type { CapabilityResponse, CapabilitySummaryResponse, OrganisationalUnitResponse } from '../../api/generated/model';

interface CapabilityListPanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
  /** The active grouping dimension; NONE keeps the plain list. */
  groupBy?: string;
}

const CapabilityListPanel: React.FC<CapabilityListPanelProps> = ({ selectedKey, onCreateClick, groupBy = NO_GROUPING }) => {
  const isGrouped = groupBy !== NO_GROUPING;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText, localizedName } = useLocale();
  const { user } = useAuth();
  const canCreate = canCreateRoot(user?.roles, 'CAPABILITY');
  const { data: response, isLoading } = useGetAllCapabilities({ query: { enabled: !isGrouped } });
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const capabilities = (response?.data as CapabilityResponse[] | undefined) ?? [];
  const allUnits = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) ?? [];
  const [filter, setFilter] = useState('');

  // Build key → capability map for child lookups
  const capMap = new Map<string, CapabilityResponse>(capabilities.map((c) => [c.key, c]));
  const unitMap = new Map<string, OrganisationalUnitResponse>(allUnits.map((u) => [u.key, u]));

  // Roots are capabilities with no parent
  const roots = [...capabilities]
    .filter((c) => !c.parent)
    .sort((a, b) => getLocalizedText(a.names, a.key).localeCompare(getLocalizedText(b.names, b.key)));

  const matchesFilter = (cap: CapabilityResponse): boolean => {
    if (!filter) return true;
    const name = getLocalizedText(cap.names, cap.key).toLowerCase();
    if (name.includes(filter.toLowerCase()) || cap.key.toLowerCase().includes(filter.toLowerCase())) return true;
    return (cap.children ?? []).some((child) => {
      const full = capMap.get(child.key);
      return full ? matchesFilter(full) : localizedName(child).toLowerCase().includes(filter.toLowerCase());
    });
  };

  const filteredRoots = roots.filter(matchesFilter);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('capability.searchPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {canCreate && (
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={onCreateClick}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('common.newBtn')}
          </Button>
        )}
      </Box>
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isGrouped ? (
          <GroupedTreeList
            resourceType="CAPABILITY"
            groupBy={groupBy}
            selectedKey={selectedKey}
            filter={filter}
            icon={<AccountTree fontSize="small" />}
            onSelect={(itemKey) => navigate(`/capabilities/${itemKey}`)}
            emptyLabel={t('capability.emptyList')}
          />
        ) : isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filteredRoots.length === 0 ? (
          <Typography
            sx={{
              color: "text.secondary",
              p: 2,
              textAlign: 'center'
            }}>
            {filter ? t('common.noResults') : t('capability.emptyList')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {filteredRoots.map((cap) => (
              <CapabilityTreeItem
                key={cap.key}
                capability={cap}
                level={0}
                selectedKey={selectedKey}
                filter={filter}
                capMap={capMap}
                unitMap={unitMap}
                matchesFilter={matchesFilter}
                onSelect={(key) => navigate(`/capabilities/${key}`)}
                getLocalizedText={getLocalizedText}
                localizedName={localizedName}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

interface TreeItemProps {
  capability: CapabilityResponse;
  level: number;
  selectedKey?: string;
  filter: string;
  capMap: Map<string, CapabilityResponse>;
  unitMap: Map<string, OrganisationalUnitResponse>;
  matchesFilter: (cap: CapabilityResponse) => boolean;
  onSelect: (key: string) => void;
  getLocalizedText: (translations: any[], fallback?: string) => string;
  localizedName: (summary: { key: string; name?: string | null; names?: any[] | null } | null | undefined) => string;
}

const CapabilityTreeItem: React.FC<TreeItemProps> = ({
  capability,
  level,
  selectedKey,
  filter,
  capMap,
  unitMap,
  matchesFilter,
  onSelect,
  getLocalizedText,
  localizedName,
}) => {
  const [open, setOpen] = useState(!filter);
  const hasChildren = (capability.children?.length ?? 0) > 0;
  const isSelected = capability.key === selectedKey;

  const sortedChildren = [...(capability.children ?? [])]
    .map((s: CapabilitySummaryResponse) => capMap.get(s.key))
    .filter((c): c is CapabilityResponse => !!c)
    .filter(matchesFilter)
    .sort((a, b) => getLocalizedText(a.names, a.key).localeCompare(getLocalizedText(b.names, b.key)));

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(capability.key)}
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
        <ListItemIcon sx={{ minWidth: 28 }}>
          <AccountTree fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" noWrap sx={{
              fontWeight: isSelected ? 600 : 400
            }}>
              {getLocalizedText(capability.names, capability.key)}
            </Typography>
          }
          secondary={
            capability.owningUnit ? (
              <Typography variant="caption" noWrap sx={{
                color: "text.secondary"
              }}>
                {localizedName(capability.owningUnit)}
              </Typography>
            ) : undefined
          }
        />
      </ListItemButton>
      {hasChildren && (
        <Collapse in={open || !!filter}>
          {sortedChildren.map((child) => (
            <CapabilityTreeItem
              key={child.key}
              capability={child}
              level={level + 1}
              selectedKey={selectedKey}
              filter={filter}
              capMap={capMap}
              unitMap={unitMap}
              matchesFilter={matchesFilter}
              onSelect={onSelect}
              getLocalizedText={getLocalizedText}
              localizedName={localizedName}
            />
          ))}
        </Collapse>
      )}
    </>
  );
};

export default CapabilityListPanel;
