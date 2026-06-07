import { useState, useEffect } from 'react';
import { Box, Typography, TextField, TablePagination } from '@mui/material';

export default function CustomPagination({
  count,
  page,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 25, 50],
}) {
  const [pageInput, setPageInput] = useState(String(page + 1));

  useEffect(() => {
    setPageInput(String(page + 1));
  }, [page]);

  const maxPages = Math.ceil(count / rowsPerPage) || 1;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', px: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Page:</Typography>
        <TextField
          size="small"
          type="number"
          variant="outlined"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onBlur={() => {
            let p = parseInt(pageInput, 10);
            if (isNaN(p) || p < 1) p = 1;
            if (p > maxPages) p = maxPages;
            onPageChange(null, p - 1);
            setPageInput(String(p));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
          inputProps={{ min: 1, max: maxPages }}
          sx={{ width: 60, '& .MuiInputBase-root': { height: 28, fontSize: '0.75rem' } }}
        />
      </Box>
      <TablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        rowsPerPageOptions={rowsPerPageOptions}
        showFirstButton
        showLastButton
        sx={{
          borderBottom: 'none',
          '& .MuiTablePagination-toolbar': {
            flexWrap: 'wrap',
            minHeight: 36,
            py: 0,
            px: 0,
            justifyContent: 'center'
          },
          '& .MuiTablePagination-selectLabel': { margin: 0, fontSize: '0.75rem' },
          '& .MuiTablePagination-displayedRows': { margin: 0, fontSize: '0.75rem' },
          '& .MuiTablePagination-actions': { marginLeft: 0 }
        }}
      />
    </Box>
  );
}
