import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Paper,
} from '@mui/material';
import { useGetAllCapabilities } from '../api/generated/capability/capability';
import { useGetAllBusinessDomains } from '../api/generated/business-domain/business-domain';
import type { CapabilityResponse } from '../api/generated/model/capabilityResponse';
import type { BusinessDomainResponse } from '../api/generated/model/businessDomainResponse';
import { useLocale } from '../context/LocaleContext';

const DOMAIN_TYPE_COLORS: Record<string, string> = {
  CORE: '#1565c0',
  SUPPORT: '#2e7d32',
  GENERIC: '#616161',
  BUSINESS: '#6a1b9a',
};

const DOMAIN_TYPE_LABELS: Record<string, string> = {
  CORE: 'Core',
  SUPPORT: 'Support',
  GENERIC: 'Generic',
  BUSINESS: 'Business',
};

function getRootCapabilities(capabilities: CapabilityResponse[]): CapabilityResponse[] {
  const keys = new Set(capabilities.map((c) => c.key));
  return capabilities.filter((c) => !c.parent?.key || !keys.has(c.parent.key));
}

function getRootDomains(domains: BusinessDomainResponse[]): BusinessDomainResponse[] {
  const keys = new Set(domains.map((d) => d.key));
  return domains.filter((d) => !d.parent?.key || !keys.has(d.parent.key));
}

/** Returns all capability keys in the subtree rooted at `cap` */
function getCapabilitySubtreeKeys(cap: CapabilityResponse, allCaps: CapabilityResponse[]): Set<string> {
  const result = new Set<string>([cap.key]);
  const queue = [cap];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = allCaps.filter((c) => c.parent?.key === current.key);
    children.forEach((c) => {
      result.add(c.key);
      queue.push(c);
    });
  }
  return result;
}

export const StrategicMapContent: React.FC = () => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();

  const { data: capsData, isLoading: capsLoading } = useGetAllCapabilities();
  const { data: domainsData, isLoading: domainsLoading } = useGetAllBusinessDomains();

  const allCapabilities = useMemo(
    () => (capsData?.data as CapabilityResponse[] | undefined) ?? [],
    [capsData],
  );
  const allDomains = useMemo(
    () => (domainsData?.data as BusinessDomainResponse[] | undefined) ?? [],
    [domainsData],
  );

  const rootCapabilities = useMemo(() => getRootCapabilities(allCapabilities), [allCapabilities]);
  const rootDomains = useMemo(() => getRootDomains(allDomains), [allDomains]);

  /**
   * For each (capability column, domain row) cell: collect bounded contexts
   * that are "owned" by org units that own capabilities in that column subtree,
   * OR simply show all bounded contexts in the domain (no capability mapping yet).
   * We show: domain bounded contexts grouped under each top-level capability column
   * based on the capability's owningUnit matching the BC's owningTeam.
   */
  const capabilitySubtrees = useMemo(() => {
    return rootCapabilities.map((cap) => ({
      cap,
      subtreeKeys: getCapabilitySubtreeKeys(cap, allCapabilities),
    }));
  }, [rootCapabilities, allCapabilities]);

  if (capsLoading || domainsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (rootDomains.length === 0 && rootCapabilities.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No domains or capabilities defined yet. Create capabilities and business domains to see the strategic map.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(DOMAIN_TYPE_LABELS).map(([type, label]) => (
          <Chip
            key={type}
            label={label}
            size="small"
            sx={{ bgcolor: DOMAIN_TYPE_COLORS[type], color: '#fff', fontSize: '0.7rem' }}
          />
        ))}
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            alignSelf: 'center',
            ml: 1
          }}>
          Domain types
        </Typography>
      </Box>
      {/* Matrix table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `200px repeat(${Math.max(rootCapabilities.length, 1)}, minmax(180px, 1fr))`,
            gap: '2px',
            minWidth: 400 + rootCapabilities.length * 180,
          }}
        >
          {/* Header row */}
          <Box sx={{ bgcolor: 'action.selected', p: 1, borderRadius: 1, display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: "text.secondary"
              }}>
              Domain / Capability
            </Typography>
          </Box>

          {rootCapabilities.length === 0 ? (
            <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>No capabilities defined</Typography>
            </Box>
          ) : (
            rootCapabilities.map((cap) => (
              <Paper
                key={cap.key}
                variant="outlined"
                onClick={() => navigate(`/capabilities/${cap.key}`)}
                sx={{
                  p: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  cursor: 'pointer',
                  borderRadius: 1,
                  '&:hover': { opacity: 0.85 },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.2
                  }}>
                  {getLocalizedText(cap.names, cap.key)}
                </Typography>
                {cap.owningUnit && (
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, fontSize: '0.65rem' }}>
                    {cap.owningUnit.name}
                  </Typography>
                )}
                {cap.children && cap.children.length > 0 && (
                  <Chip
                    label={`${cap.children.length} sub`}
                    size="small"
                    sx={{ height: 16, fontSize: '0.6rem', mt: 0.5, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
                  />
                )}
              </Paper>
            ))
          )}

          {/* Domain rows */}
          {rootDomains.map((domain) => {
            const domainName = getLocalizedText(domain.names, domain.key);
            const domainType = domain.effectiveType ?? domain.type;
            const typeColor = domainType ? DOMAIN_TYPE_COLORS[domainType] : '#9e9e9e';
            const typeLabel = domainType ? DOMAIN_TYPE_LABELS[domainType] : null;
            const bcs = domain.boundedContexts ?? [];
            const subdomains = domain.subdomains ?? [];

            return (
              <React.Fragment key={domain.key}>
                {/* Domain label cell */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderLeft: `4px solid ${typeColor}`,
                    borderRadius: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    minHeight: 72,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.2
                    }}>
                    {domainName}
                  </Typography>
                  {typeLabel && (
                    <Chip
                      label={typeLabel}
                      size="small"
                      sx={{ width: 'fit-content', height: 16, fontSize: '0.65rem', bgcolor: typeColor, color: '#fff' }}
                    />
                  )}
                  {subdomains.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontSize: '0.65rem'
                      }}>
                      {subdomains.length} subdomain{subdomains.length !== 1 ? 's' : ''}
                    </Typography>
                  )}
                </Paper>
                {/* Capability cells for this domain */}
                {rootCapabilities.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, minHeight: 72 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {bcs.map((bc) => (
                        <Tooltip key={bc.key} title={bc.key}>
                          <Chip
                            label={bc.name}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        </Tooltip>
                      ))}
                      {bcs.length === 0 && (
                        <Typography variant="caption" sx={{
                          color: "text.disabled"
                        }}>—</Typography>
                      )}
                    </Box>
                  </Paper>
                ) : (
                  rootCapabilities.map((cap) => {
                    // Show BCs in this domain cell — all BCs for the domain are shown in all cells
                    // as there's no direct BC→Capability mapping; this shows the domain's BCs
                    // alongside each capability for alignment discussion
                    const subtreeKeys = capabilitySubtrees.find((s) => s.cap.key === cap.key)?.subtreeKeys ?? new Set();
                    const capChildCount = subtreeKeys.size - 1; // exclude root itself

                    return (
                      <Paper
                        key={`${domain.key}-${cap.key}`}
                        variant="outlined"
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          minHeight: 72,
                          bgcolor: bcs.length > 0 ? 'action.hover' : 'background.default',
                        }}
                      >
                        {bcs.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {bcs.map((bc) => (
                              <Tooltip key={bc.key} title={bc.key}>
                                <Chip
                                  label={bc.name}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 18, borderColor: typeColor }}
                                />
                              </Tooltip>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{
                            color: "text.disabled"
                          }}>—</Typography>
                        )}
                        {capChildCount > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              display: 'block',
                              mt: 0.5,
                              fontSize: '0.6rem'
                            }}>
                            {capChildCount} sub-cap{capChildCount !== 1 ? 's' : ''}
                          </Typography>
                        )}
                      </Paper>
                    );
                  })
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
      {/* All bounded contexts summary */}
      {rootDomains.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              mb: 1
            }}>
            Bounded Contexts Overview
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {rootDomains.map((domain) => {
              const bcs = domain.boundedContexts ?? [];
              if (bcs.length === 0) return null;
              const domainType = domain.effectiveType ?? domain.type;
              const typeColor = domainType ? DOMAIN_TYPE_COLORS[domainType] : '#9e9e9e';
              return (
                <Paper key={domain.key} variant="outlined" sx={{ p: 1, borderLeft: `3px solid ${typeColor}`, minWidth: 160 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: "text.secondary",
                      display: 'block',
                      mb: 0.5
                    }}>
                    {getLocalizedText(domain.names, domain.key)}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {bcs.map((bc) => (
                      <Chip key={bc.key} label={bc.name} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                    ))}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const StrategicMapPage: React.FC = () => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="h6" sx={{
          fontWeight: 600
        }}>Strategic Map</Typography>
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          Business domains (rows) × top-level capabilities (columns) — bounded contexts and alignment overview.
        </Typography>
      </Box>
      <StrategicMapContent />
    </Box>
  );
};

export default StrategicMapPage;
