import React, { useState } from 'react';
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
  Chip,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Search,
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
} from '@mui/icons-material';
import { useGetOrganisationalUnitTree } from '../../api/generated/organisational-unit/organisational-unit';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import type { OrganisationalUnitTreeResponse } from '../../api/generated/model';

interface OrgUnitTreePanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const OrgUnitTreePanel: React.FC<OrgUnitTreePanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: treeResponse, isLoading } = useGetOrganisationalUnitTree();
  const tree = (treeResponse?.data as OrganisationalUnitTreeResponse[] | undefined) || [];
  const [filter, setFilter] = useState('');

  const matchesFilter = (unit: OrganisationalUnitTreeResponse): boolean => {
    if (!filter) return true;
    const name = getLocalizedText(unit.names).toLowerCase();
    if (name.includes(filter.toLowerCase())) return true;
    return unit.children?.some(matchesFilter) ?? false;
  };

  const filteredTree = tree.filter(matchesFilter);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search units..."
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
        {isAdmin && (
          <Button variant="contained" size="small" startIcon={<Add />} onClick={onCreateClick} sx={{ whiteSpace: 'nowrap' }}>
            New
          </Button>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Typography sx={{ p: 2 }} color="text.secondary">Loading...</Typography>
        ) : filteredTree.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }} color="text.secondary">
            {filter ? 'No matches found.' : 'No units yet. Create one to get started.'}
          </Typography>
        ) : (
          <List dense disablePadding>
            {filteredTree.map((unit) => (
              <TreeItem
                key={unit.key}
                unit={unit}
                level={0}
                selectedKey={selectedKey}
                filter={filter}
                onSelect={(key) => navigate(`/organisation/${key}`)}
                getLocalizedText={getLocalizedText}
                matchesFilter={matchesFilter}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

interface TreeItemProps {
  unit: OrganisationalUnitTreeResponse;
  level: number;
  selectedKey?: string;
  filter: string;
  onSelect: (key: string) => void;
  getLocalizedText: (translations: any[], fallback?: string) => string;
  matchesFilter: (unit: OrganisationalUnitTreeResponse) => boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({
  unit,
  level,
  selectedKey,
  filter,
  onSelect,
  getLocalizedText,
  matchesFilter,
}) => {
  const [open, setOpen] = useState(!filter);
  const hasChildren = unit.children && unit.children.length > 0;
  const isSelected = unit.key === selectedKey;
  const filteredChildren = unit.children?.filter(matchesFilter) || [];

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(unit.key)}
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
          {hasChildren && open ? <FolderOpen fontSize="small" /> : <Folder fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" noWrap>
                {getLocalizedText(unit.names, 'Unnamed')}
              </Typography>
              {unit.unitType && (
                <Chip
                  label={unit.unitType}
                  size="small"
                  color="primary"
                  variant="filled"
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}
            </Box>
          }
        />
      </ListItemButton>
      {hasChildren && (
        <Collapse in={open || !!filter}>
          {filteredChildren.map((child) => (
            <TreeItem
              key={child.key}
              unit={child}
              level={level + 1}
              selectedKey={selectedKey}
              filter={filter}
              onSelect={onSelect}
              getLocalizedText={getLocalizedText}
              matchesFilter={matchesFilter}
            />
          ))}
        </Collapse>
      )}
    </>
  );
};

export default OrgUnitTreePanel;
