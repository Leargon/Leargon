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
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Search,
  ExpandMore,
  ChevronRight,
  AccountTree,
} from '@mui/icons-material';
import { useGetBusinessEntityTree } from '../../api/generated/business-entity/business-entity';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import type { BusinessEntityTreeResponse } from '../../api/generated/model';

interface EntityTreePanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const EntityTreePanel: React.FC<EntityTreePanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: treeResponse, isLoading } = useGetBusinessEntityTree();
  const tree = (treeResponse?.data as BusinessEntityTreeResponse[] | undefined) || [];
  const [filter, setFilter] = useState('');

  const matchesFilter = (entity: BusinessEntityTreeResponse): boolean => {
    if (!filter) return true;
    const name = getLocalizedText(entity.names).toLowerCase();
    if (name.includes(filter.toLowerCase())) return true;
    return entity.children?.some(matchesFilter) ?? false;
  };

  const filteredTree = tree.filter(matchesFilter);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search entities..."
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
            {filter ? 'No matches found.' : 'No entities yet. Create one to get started.'}
          </Typography>
        ) : (
          <List dense disablePadding>
            {filteredTree.map((entity) => (
              <TreeItem
                key={entity.key}
                entity={entity}
                level={0}
                selectedKey={selectedKey}
                filter={filter}
                onSelect={(key) => navigate(`/entities/${key}`)}
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
  entity: BusinessEntityTreeResponse;
  level: number;
  selectedKey?: string;
  filter: string;
  onSelect: (key: string) => void;
  getLocalizedText: (translations: any[], fallback?: string) => string;
  matchesFilter: (entity: BusinessEntityTreeResponse) => boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({
  entity,
  level,
  selectedKey,
  filter,
  onSelect,
  getLocalizedText,
  matchesFilter,
}) => {
  const [open, setOpen] = useState(!filter);
  const hasChildren = entity.children && entity.children.length > 0;
  const isSelected = entity.key === selectedKey;
  const filteredChildren = entity.children?.filter(matchesFilter) || [];

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(entity.key)}
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
            <Typography variant="body2" noWrap>
              {getLocalizedText(entity.names, 'Unnamed')}
            </Typography>
          }
        />
      </ListItemButton>
      {hasChildren && (
        <Collapse in={open || !!filter}>
          {filteredChildren.map((child) => (
            <TreeItem
              key={child.key}
              entity={child}
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

export default EntityTreePanel;
