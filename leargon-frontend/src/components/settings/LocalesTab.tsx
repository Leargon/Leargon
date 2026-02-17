import React, { useState, useMemo } from 'react';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  Box,
  Alert,
  Tooltip,
  Radio,
  Autocomplete,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetSupportedLocales,
  getGetSupportedLocalesQueryKey,
  useCreateSupportedLocale,
  useUpdateSupportedLocale,
  useDeleteSupportedLocale,
} from '../../api/generated/locale/locale';
import type { SupportedLocaleResponse } from '../../api/generated/model';

// ISO 639-1 language codes with display names
const ISO_LANGUAGES: { code: string; name: string }[] = [
  { code: 'aa', name: 'Afar' },
  { code: 'ab', name: 'Abkhazian' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'ak', name: 'Akan' },
  { code: 'am', name: 'Amharic' },
  { code: 'an', name: 'Aragonese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'as', name: 'Assamese' },
  { code: 'av', name: 'Avaric' },
  { code: 'ay', name: 'Aymara' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'ba', name: 'Bashkir' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'bh', name: 'Bihari' },
  { code: 'bi', name: 'Bislama' },
  { code: 'bm', name: 'Bambara' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bo', name: 'Tibetan' },
  { code: 'br', name: 'Breton' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'ce', name: 'Chechen' },
  { code: 'ch', name: 'Chamorro' },
  { code: 'co', name: 'Corsican' },
  { code: 'cr', name: 'Cree' },
  { code: 'cs', name: 'Czech' },
  { code: 'cu', name: 'Church Slavic' },
  { code: 'cv', name: 'Chuvash' },
  { code: 'cy', name: 'Welsh' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'dv', name: 'Divehi' },
  { code: 'dz', name: 'Dzongkha' },
  { code: 'ee', name: 'Ewe' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'es', name: 'Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'eu', name: 'Basque' },
  { code: 'fa', name: 'Persian' },
  { code: 'ff', name: 'Fulah' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fj', name: 'Fijian' },
  { code: 'fo', name: 'Faroese' },
  { code: 'fr', name: 'French' },
  { code: 'fy', name: 'Western Frisian' },
  { code: 'ga', name: 'Irish' },
  { code: 'gd', name: 'Scottish Gaelic' },
  { code: 'gl', name: 'Galician' },
  { code: 'gn', name: 'Guarani' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'gv', name: 'Manx' },
  { code: 'ha', name: 'Hausa' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ho', name: 'Hiri Motu' },
  { code: 'hr', name: 'Croatian' },
  { code: 'ht', name: 'Haitian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'hz', name: 'Herero' },
  { code: 'ia', name: 'Interlingua' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ie', name: 'Interlingue' },
  { code: 'ig', name: 'Igbo' },
  { code: 'ii', name: 'Sichuan Yi' },
  { code: 'ik', name: 'Inupiaq' },
  { code: 'io', name: 'Ido' },
  { code: 'is', name: 'Icelandic' },
  { code: 'it', name: 'Italian' },
  { code: 'iu', name: 'Inuktitut' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jv', name: 'Javanese' },
  { code: 'ka', name: 'Georgian' },
  { code: 'kg', name: 'Kongo' },
  { code: 'ki', name: 'Kikuyu' },
  { code: 'kj', name: 'Kuanyama' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'kl', name: 'Kalaallisut' },
  { code: 'km', name: 'Khmer' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'kr', name: 'Kanuri' },
  { code: 'ks', name: 'Kashmiri' },
  { code: 'ku', name: 'Kurdish' },
  { code: 'kv', name: 'Komi' },
  { code: 'kw', name: 'Cornish' },
  { code: 'ky', name: 'Kirghiz' },
  { code: 'la', name: 'Latin' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'lg', name: 'Ganda' },
  { code: 'li', name: 'Limburgish' },
  { code: 'ln', name: 'Lingala' },
  { code: 'lo', name: 'Lao' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lu', name: 'Luba-Katanga' },
  { code: 'lv', name: 'Latvian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'mh', name: 'Marshallese' },
  { code: 'mi', name: 'Maori' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ms', name: 'Malay' },
  { code: 'mt', name: 'Maltese' },
  { code: 'my', name: 'Burmese' },
  { code: 'na', name: 'Nauru' },
  { code: 'nb', name: 'Norwegian Bokm\u00e5l' },
  { code: 'nd', name: 'North Ndebele' },
  { code: 'ne', name: 'Nepali' },
  { code: 'ng', name: 'Ndonga' },
  { code: 'nl', name: 'Dutch' },
  { code: 'nn', name: 'Norwegian Nynorsk' },
  { code: 'no', name: 'Norwegian' },
  { code: 'nr', name: 'South Ndebele' },
  { code: 'nv', name: 'Navajo' },
  { code: 'ny', name: 'Chichewa' },
  { code: 'oc', name: 'Occitan' },
  { code: 'oj', name: 'Ojibwa' },
  { code: 'om', name: 'Oromo' },
  { code: 'or', name: 'Oriya' },
  { code: 'os', name: 'Ossetian' },
  { code: 'pa', name: 'Panjabi' },
  { code: 'pi', name: 'Pali' },
  { code: 'pl', name: 'Polish' },
  { code: 'ps', name: 'Pashto' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'qu', name: 'Quechua' },
  { code: 'rm', name: 'Romansh' },
  { code: 'rn', name: 'Rundi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'sc', name: 'Sardinian' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'se', name: 'Northern Sami' },
  { code: 'sg', name: 'Sango' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sm', name: 'Samoan' },
  { code: 'sn', name: 'Shona' },
  { code: 'so', name: 'Somali' },
  { code: 'sq', name: 'Albanian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'ss', name: 'Swati' },
  { code: 'st', name: 'Southern Sotho' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'tg', name: 'Tajik' },
  { code: 'th', name: 'Thai' },
  { code: 'ti', name: 'Tigrinya' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tn', name: 'Tswana' },
  { code: 'to', name: 'Tonga' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ts', name: 'Tsonga' },
  { code: 'tt', name: 'Tatar' },
  { code: 'tw', name: 'Twi' },
  { code: 'ty', name: 'Tahitian' },
  { code: 'ug', name: 'Uighur' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'uz', name: 'Uzbek' },
  { code: 've', name: 'Venda' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'vo', name: 'Volap\u00fck' },
  { code: 'wa', name: 'Walloon' },
  { code: 'wo', name: 'Wolof' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'za', name: 'Zhuang' },
  { code: 'zh', name: 'Chinese' },
  { code: 'zu', name: 'Zulu' },
];

interface LocalesTabProps {
  allowSetDefault?: boolean;
}

const LocalesTab: React.FC<LocalesTabProps> = ({ allowSetDefault = false }) => {
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales({ 'include-inactive': true });
  const locales = localesResponse?.data || [];

  const createLocale = useCreateSupportedLocale();
  const updateLocale = useUpdateSupportedLocale();
  const deleteLocale = useDeleteSupportedLocale();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<{ code: string; name: string } | null>(null);

  // Filter out already-added locale codes from the autocomplete options
  const existingCodes = useMemo(() => new Set(locales.map((l) => l.localeCode)), [locales]);
  const availableLanguages = useMemo(
    () => ISO_LANGUAGES.filter((lang) => !existingCodes.has(lang.code)),
    [existingCodes],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSupportedLocalesQueryKey() });
  };

  const handleCreate = async () => {
    if (!selectedLanguage) {
      setError('Please select a language');
      return;
    }
    try {
      setError('');
      await createLocale.mutateAsync({
        data: { localeCode: selectedLanguage.code, displayName: selectedLanguage.name },
      });
      setSuccess(`Locale "${selectedLanguage.code}" (${selectedLanguage.name}) created`);
      setCreateOpen(false);
      setSelectedLanguage(null);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create locale');
    }
  };

  const handleSetDefault = async (locale: SupportedLocaleResponse) => {
    if (locale.isDefault) return;
    try {
      setError('');
      await updateLocale.mutateAsync({ id: locale.id, data: { isDefault: true } });
      setSuccess(`"${locale.displayName}" is now the default locale`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to set default locale');
    }
  };

  const handleToggleActive = async (locale: SupportedLocaleResponse) => {
    try {
      setError('');
      await updateLocale.mutateAsync({ id: locale.id, data: { isActive: !locale.isActive } });
      setSuccess(`Locale "${locale.localeCode}" ${locale.isActive ? 'deactivated' : 'activated'}`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update locale');
    }
  };

  const handleMove = async (locale: SupportedLocaleResponse, direction: 'up' | 'down') => {
    const sorted = [...locales].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((l) => l.id === locale.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    try {
      setError('');
      await updateLocale.mutateAsync({ id: locale.id, data: { sortOrder: other.sortOrder } });
      await updateLocale.mutateAsync({ id: other.id, data: { sortOrder: locale.sortOrder } });
      setSuccess(`Moved "${locale.localeCode}" ${direction}`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update sort order');
    }
  };

  const handleDelete = async (locale: SupportedLocaleResponse) => {
    try {
      setError('');
      await deleteLocale.mutateAsync({ id: locale.id });
      setSuccess(`Locale "${locale.localeCode}" deleted`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete locale');
    }
  };

  const sorted = [...locales].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Locale Management</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add Locale
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Locale Code</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Default</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Order</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((locale, index) => (
              <TableRow key={locale.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{locale.localeCode}</Typography>
                </TableCell>
                <TableCell>{locale.displayName}</TableCell>
                <TableCell>
                  {allowSetDefault ? (
                    <Tooltip
                      title={
                        locale.isDefault
                          ? 'Current default'
                          : locale.isActive
                            ? 'Set as default'
                            : 'Activate locale first to set as default'
                      }
                    >
                      <span>
                        <Radio
                          checked={locale.isDefault}
                          onChange={() => handleSetDefault(locale)}
                          size="small"
                          disabled={locale.isDefault || !locale.isActive}
                        />
                      </span>
                    </Tooltip>
                  ) : (
                    locale.isDefault && <Chip label="Default" color="primary" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={locale.isActive}
                    onChange={() => handleToggleActive(locale)}
                    size="small"
                    disabled={locale.isDefault}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton size="small" onClick={() => handleMove(locale, 'up')} disabled={index === 0}>
                      <ArrowUpIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleMove(locale, 'down')} disabled={index === sorted.length - 1}>
                      <ArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={locale.isDefault ? 'Cannot delete default locale' : 'Delete'}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(locale)}
                        disabled={locale.isDefault}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Locale Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Locale</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              options={availableLanguages}
              getOptionLabel={(option) => `${option.name} (${option.code})`}
              value={selectedLanguage}
              onChange={(_e, value) => setSelectedLanguage(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Language"
                  size="small"
                  placeholder="Search languages..."
                  helperText="Select an ISO 639-1 language"
                />
              )}
              isOptionEqualToValue={(option, value) => option.code === value.code}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setSelectedLanguage(null); }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createLocale.isPending || !selectedLanguage}>
            {createLocale.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LocalesTab;
