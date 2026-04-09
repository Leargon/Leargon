import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    CircularProgress,
    Divider,
    InputAdornment,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Popper,
    TextField,
    Typography,
} from '@mui/material';
import {
    AccountTree,
    CorporateFare,
    Hub,
    Route,
    Search,
} from '@mui/icons-material';
import { useLocale } from '../../context/LocaleContext';
import { useSearch } from '../../api/generated/search/search';
import type { SearchResultResponse } from '../../api/generated/model';
import { SearchResultType } from '../../api/generated/model';

const TYPE_CONFIG: Record<
    string,
    { icon: React.ReactNode; label: string; path: string }
> = {
    [SearchResultType.BUSINESS_ENTITY]: {
        icon: <AccountTree fontSize="small" />,
        label: 'Entities',
        path: '/entities',
    },
    [SearchResultType.BUSINESS_DOMAIN]: {
        icon: <Hub fontSize="small" />,
        label: 'Domains',
        path: '/domains',
    },
    [SearchResultType.BUSINESS_PROCESS]: {
        icon: <Route fontSize="small" />,
        label: 'Processes',
        path: '/processes',
    },
    [SearchResultType.ORGANISATIONAL_UNIT]: {
        icon: <CorporateFare fontSize="small" />,
        label: 'Org Units',
        path: '/organisation',
    },
};

const GlobalSearch: React.FC = () => {
    const navigate = useNavigate();
    const { getLocalizedText } = useLocale();
    const [inputValue, setInputValue] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);

    // Debounce the search query by 300ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(inputValue.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    const enabled = debouncedQuery.length >= 2;

    const { data, isFetching } = useSearch(
        { q: debouncedQuery, limit: 20 },
        { query: { enabled, retry: false } },
    );

    const results = data?.data?.results ?? [];

    useEffect(() => {
        setOpen(enabled && !isFetching);
    }, [enabled, isFetching, results]);

    const grouped = results.reduce<Record<string, SearchResultResponse[]>>(
        (acc, result) => {
            const key = result.type ?? 'UNKNOWN';
            if (!acc[key]) acc[key] = [];
            acc[key].push(result);
            return acc;
        },
        {},
    );

    const handleSelect = useCallback(
        (result: SearchResultResponse) => {
            const config = TYPE_CONFIG[result.type ?? ''];
            if (config && result.key) {
                navigate(`${config.path}/${result.key}`);
            }
            setInputValue('');
            setDebouncedQuery('');
            setOpen(false);
        },
        [navigate],
    );

    const handleBlur = useCallback(() => {
        // Delay close so clicks on results register first
        setTimeout(() => setOpen(false), 150);
    }, []);

    return (
        <Box ref={anchorRef} sx={{ position: 'relative', width: 220 }}>
            <TextField
                size="small"
                placeholder="Search…"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    if (e.target.value.trim().length >= 2) setOpen(true);
                    else setOpen(false);
                }}
                onFocus={() => {
                    if (enabled) setOpen(true);
                }}
                onBlur={handleBlur}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                {isFetching ? (
                                    <CircularProgress size={14} sx={{ color: 'grey.400' }} />
                                ) : (
                                    <Search sx={{ fontSize: 16, color: 'grey.400' }} />
                                )}
                            </InputAdornment>
                        ),
                    },
                }}
                sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                        height: 30,
                        fontSize: '0.8rem',
                        color: 'grey.300',
                        bgcolor: 'rgba(255,255,255,0.06)',
                        borderRadius: 1,
                    },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.500' },
                    '& .MuiInputBase-input::placeholder': { color: 'grey.500', opacity: 1 },
                }}
            />
            <Popper
                open={open}
                anchorEl={anchorRef.current}
                placement="bottom-start"
                style={{ zIndex: 1400, width: anchorRef.current?.offsetWidth ?? 220 }}
                modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
            >
                <Paper
                    elevation={8}
                    sx={{
                        maxHeight: 400,
                        overflow: 'auto',
                        minWidth: 280,
                        border: 1,
                        borderColor: 'grey.700',
                    }}
                >
                    {results.length === 0 && !isFetching ? (
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                px: 2,
                                py: 1.5
                            }}>
                            No results for &quot;{debouncedQuery}&quot;
                        </Typography>
                    ) : (
                        Object.entries(grouped).map(([type, items], idx) => {
                            const config = TYPE_CONFIG[type];
                            return (
                                <React.Fragment key={type}>
                                    {idx > 0 && <Divider />}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            px: 1.5,
                                            pt: 0.5,
                                            pb: 0.25,
                                            color: 'text.secondary',
                                        }}
                                    >
                                        {config?.icon}
                                        <Typography variant="caption" sx={{
                                            fontWeight: 600
                                        }}>
                                            {config?.label ?? type}
                                        </Typography>
                                    </Box>
                                    <List dense disablePadding>
                                        {items.map((result) => (
                                            <ListItemButton
                                                key={result.key ?? result.matchedIn}
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // prevent input blur before navigation fires
                                                    handleSelect(result);
                                                }}
                                                sx={{ py: 0.5, px: 2 }}
                                            >
                                                <ListItemText
                                                    primary={getLocalizedText(
                                                        result.names ?? [],
                                                        result.key ?? '',
                                                    )}
                                                    secondary={result.key}
                                                    slotProps={{
                                                        primary: { sx: { fontSize: '0.85rem' } },

                                                        secondary: {
                                                            sx: {
                                                                fontSize: '0.7rem',
                                                                color: 'text.disabled',
                                                            }
                                                        }
                                                    }} />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </React.Fragment>
                            );
                        })
                    )}
                </Paper>
            </Popper>
        </Box>
    );
};

export default GlobalSearch;
