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
import { useGetBusinessDomainTree } from '../../api/generated/business-domain/business-domain';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import type { BusinessDomainTreeResponse } from '../../api/generated/model';

interface DomainTreePanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const DomainTreePanel: React.FC<DomainTreePanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: treeResponse, isLoading } = useGetBusinessDomainTree();
  const tree = (treeResponse?.data as BusinessDomainTreeResponse[] | undefined) || [];
  const [filter, setFilter] = useState('');

  const matchesFilter = (domain: BusinessDomainTreeResponse): boolean => {
    if (!filter) return true;
    const name = getLocalizedText(domain.names).toLowerCase();
    if (name.includes(filter.toLowerCase())) return true;
    return domain.children?.some(matchesFilter) ?? false;
  };

  const filteredTree = tree.filter(matchesFilter);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search domains..."
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
            {filter ? 'No matches found.' : 'No domains yet. Create one to get started.'}
          </Typography>
        ) : (
          <List dense disablePadding>
            {filteredTree.map((domain) => (
              <TreeItem
                key={domain.key}
                domain={domain}
                level={0}
                selectedKey={selectedKey}
                filter={filter}
                onSelect={(key) => navigate(`/domains/${key}`)}
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
  domain: BusinessDomainTreeResponse;
  level: number;
  selectedKey?: string;
  filter: string;
  onSelect: (key: string) => void;
  getLocalizedText: (translations: any[], fallback?: string) => string;
  matchesFilter: (domain: BusinessDomainTreeResponse) => boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({
  domain,
  level,
  selectedKey,
  filter,
  onSelect,
  getLocalizedText,
  matchesFilter,
}) => {
  const [open, setOpen] = useState(!filter);
  const hasChildren = domain.children && domain.children.length > 0;
  const isSelected = domain.key === selectedKey;
  const filteredChildren = domain.children?.filter(matchesFilter) || [];

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(domain.key)}
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
                {getLocalizedText(domain.names, 'Unnamed')}
              </Typography>
              {domain.effectiveType && (
                <Chip
                  label={domain.effectiveType}
                  size="small"
                  color={domain.type ? 'primary' : 'default'}
                  variant={domain.type ? 'filled' : 'outlined'}
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
              domain={child}
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

export default DomainTreePanel;
