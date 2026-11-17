/**
 * 엑셀 일괄 대사 및 부가세 검증 모듈 (Excel Reconciler & Batch Calculator)
 */
(function () {
  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('excelFileInput');
  const excelControlSection = document.getElementById('excelControlSection');
  const excelFileName = document.getElementById('excelFileName');
  const excelSheetSelect = document.getElementById('excelSheetSelect');
  const excelRowCount = document.getElementById('excelRowCount');
  const btnResetExcel = document.getElementById('btnResetExcel');

  // Mapping Selects
  const colMapItem = document.getElementById('colMapItem');
  const colMapSupply = document.getElementById('colMapSupply');
  const colMapVat = document.getElementById('colMapVat');
  const colMapTotal = document.getElementById('colMapTotal');
  const excelRoundingMode = document.getElementById('excelRoundingMode');

  // Stats
  const statSumSupply = document.getElementById('statSumSupply');
  const statSumVat = document.getElementById('statSumVat');
  const statSumTotal = document.getElementById('statSumTotal');
  const statMismatchCount = document.getElementById('statMismatchCount');
  const statMismatchDesc = document.getElementById('statMismatchDesc');

  // Filter Buttons
  const filterPills = document.querySelectorAll('.filter-pill');
  const filterCountAll = document.getElementById('filterCountAll');
  const filterCountMismatch = document.getElementById('filterCountMismatch');
  const filterCountMatch = document.getElementById('filterCountMatch');

  // Table
  const excelTableBody = document.getElementById('excelTableBody');

  // Action Buttons
  const btnRecalcFromSupply = document.getElementById('btnRecalcFromSupply');
  const btnRecalcFromTotal = document.getElementById('btnRecalcFromTotal');
  const btnExportAuditedExcel = document.getElementById('btnExportAuditedExcel');
  const btnDownloadSample = document.getElementById('btnDownloadSample');

  // State
  let currentWorkbook = null;
  let currentSheetData = []; // raw json rows
  let sheetColumns = [];
  let auditedRows = [];
  let currentFilter = 'all';

  // --------------------------------------------------------------------------
  // Drag & Drop Handling
  // --------------------------------------------------------------------------
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  btnResetExcel.addEventListener('click', () => {
    fileInput.value = '';
    currentWorkbook = null;
    currentSheetData = [];
    auditedRows = [];
    dropZone.classList.remove('hidden');
    excelControlSection.classList.add('hidden');
  });

  // --------------------------------------------------------------------------
  // File Parsing via SheetJS
  // --------------------------------------------------------------------------
  function handleFile(file) {
    if (typeof XLSX === 'undefined') {
      alert('엑셀 파싱 라이브러리(SheetJS)가 아직 로드되지 않았습니다. 인터넷 연결을 확인해주세요.');
      return;
    }

    excelFileName.textContent = file.name;
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        currentWorkbook = XLSX.read(data, { type: 'array' });

        // Populate Sheet Select
        excelSheetSelect.innerHTML = '';
        currentWorkbook.SheetNames.forEach((sheetName) => {
          const opt = document.createElement('option');
          opt.value = sheetName;
          opt.textContent = sheetName;
          excelSheetSelect.appendChild(opt);
        });

        loadSheet(currentWorkbook.SheetNames[0]);

        dropZone.classList.add('hidden');
        excelControlSection.classList.remove('hidden');
      } catch (err) {
        console.error('엑셀 파일 읽기 오류:', err);
        alert('엑셀 파일을 읽는 도중 오류가 발생했습니다: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  excelSheetSelect.addEventListener('change', (e) => {
    loadSheet(e.target.value);
  });

  function loadSheet(sheetName) {
    if (!currentWorkbook) return;
    const worksheet = currentWorkbook.Sheets[sheetName];
    // Convert to 2D array or JSON
    const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawJson || rawJson.length === 0) {
      alert('선택한 시트에 데이터가 비어 있습니다.');
      return;
    }

    currentSheetData = rawJson;
    excelRowCount.textContent = `${currentSheetData.length.toLocaleString('ko-KR')}건`;

    // Extract Column Headers
    sheetColumns = Object.keys(currentSheetData[0]);
    populateColumnSelects(sheetColumns);
    autoDetectColumns(sheetColumns);

    runAudit();
  }

  // --------------------------------------------------------------------------
  // Column Mapping & Auto Detection
  // --------------------------------------------------------------------------
  function populateColumnSelects(columns) {
    const selects = [colMapItem, colMapSupply, colMapVat, colMapTotal];
    selects.forEach(sel => {
      sel.innerHTML = '<option value="">(선택 안 함 / 자동 계산)</option>';
      columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        sel.appendChild(opt);
      });
    });
  }

  function autoDetectColumns(columns) {
    // Keywords for auto matching
    const itemKeywords = ['품목', '품명', '적요', '내용', '상품', '항목', 'item', 'name', 'title'];
    const supplyKeywords = ['공급가액', '공급가', '단가금액', '과세표준', '금액', 'supply', 'amount', 'price'];
    const vatKeywords = ['부가세', '세액', '부가가치세', 'vat', 'tax'];
    const totalKeywords = ['합계', '합계금액', '총액', '공급대가', '결제금액', 'total', 'sum'];

    function findMatch(keywords) {
      return columns.find(col => {
        const lower = String(col).toLowerCase().replace(/\s+/g, '');
        return keywords.some(k => lower.includes(k));
      });
    }

    const itemCol = findMatch(itemKeywords);
    const supplyCol = findMatch(supplyKeywords);
    const vatCol = findMatch(vatKeywords);
    const totalCol = findMatch(totalKeywords);

    if (itemCol) colMapItem.value = itemCol;
    if (supplyCol) colMapSupply.value = supplyCol;
    if (vatCol) colMapVat.value = vatCol;
    if (totalCol) colMapTotal.value = totalCol;
  }

  [colMapItem, colMapSupply, colMapVat, colMapTotal, excelRoundingMode].forEach(el => {
    el.addEventListener('change', runAudit);
  });

  // --------------------------------------------------------------------------
  // Audit (대사) Logic
  // --------------------------------------------------------------------------
  function cleanNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/,/g, '').trim();
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  }

  function runAudit() {
    if (!currentSheetData || currentSheetData.length === 0) return;

    const itemKey = colMapItem.value;
    const supplyKey = colMapSupply.value;
    const vatKey = colMapVat.value;
    const totalKey = colMapTotal.value;
    const rounding = excelRoundingMode.value;

    let sumSupply = 0;
    let sumVat = 0;
    let sumTotal = 0;
    let mismatchCount = 0;

    auditedRows = currentSheetData.map((row, index) => {
      const itemName = itemKey ? String(row[itemKey] || `항목 #${index + 1}`) : `항목 #${index + 1}`;
      const rawSupply = supplyKey ? cleanNumber(row[supplyKey]) : null;
      const rawVat = vatKey ? cleanNumber(row[vatKey]) : null;
      const rawTotal = totalKey ? cleanNumber(row[totalKey]) : null;

      // Primary baseline: supply value
      let baseSupply = 0;
      if (rawSupply !== null) {
        baseSupply = rawSupply;
      } else if (rawTotal !== null) {
        // Fallback: derive from total if supply column not mapped
        const calcRev = VatCalculator.calculateFromTotal({ total: rawTotal, taxType: 'general', rounding });
        baseSupply = calcRev.supply;
      }

      // Expected calculation (10% VAT with selected rounding)
      const expectedCalc = VatCalculator.calculateFromSupply({
        supply: baseSupply,
        taxType: 'general',
        rounding
      });

      const calcVat = expectedCalc.vat;
      const calcTotal = expectedCalc.total;

      // Reconciliation checks
      let hasVatDiff = false;
      let hasTotalDiff = false;
      let diffMessages = [];

      if (rawVat !== null && Math.abs(rawVat - calcVat) >= 1) {
        hasVatDiff = true;
        const diff = rawVat - calcVat;
        diffMessages.push(`세액 오차 ${diff > 0 ? '+' : ''}${diff.toLocaleString('ko-KR')}원`);
      }

      if (rawTotal !== null && Math.abs(rawTotal - calcTotal) >= 1) {
        hasTotalDiff = true;
        const diff = rawTotal - calcTotal;
        diffMessages.push(`합계 오차 ${diff > 0 ? '+' : ''}${diff.toLocaleString('ko-KR')}원`);
      }

      let status = 'match';
      if (hasVatDiff && hasTotalDiff) {
        status = 'diff-both';
        mismatchCount++;
      } else if (hasVatDiff) {
        status = 'diff-vat';
        mismatchCount++;
      } else if (hasTotalDiff) {
        status = 'diff-total';
        mismatchCount++;
      }

      const finalSupply = rawSupply !== null ? rawSupply : baseSupply;
      const finalVat = rawVat !== null ? rawVat : calcVat;
      const finalTotal = rawTotal !== null ? rawTotal : calcTotal;

      sumSupply += finalSupply;
      sumVat += finalVat;
      sumTotal += finalTotal;

      return {
        index: index + 1,
        itemName,
        rawSupply,
        rawVat,
        rawTotal,
        calcVat,
        calcTotal,
        status,
        diffDesc: diffMessages.length > 0 ? diffMessages.join(' | ') : '일치',
        originalRow: row
      };
    });

    // Update Summary Stats
    statSumSupply.textContent = `${sumSupply.toLocaleString('ko-KR')} 원`;
    statSumVat.textContent = `${sumVat.toLocaleString('ko-KR')} 원`;
    statSumTotal.textContent = `${sumTotal.toLocaleString('ko-KR')} 원`;

    statMismatchCount.textContent = `${mismatchCount.toLocaleString('ko-KR')} 건`;
    if (mismatchCount > 0) {
      statMismatchDesc.textContent = '확인 요망 (단수/금액 불일치)';
      statMismatchDesc.style.color = '#dc2626';
    } else {
      statMismatchDesc.textContent = '모든 데이터 완벽 일치';
      statMismatchDesc.style.color = '#15803d';
    }

    // Update Filter Pill Counts
    filterCountAll.textContent = auditedRows.length.toLocaleString('ko-KR');
    filterCountMismatch.textContent = mismatchCount.toLocaleString('ko-KR');
    filterCountMatch.textContent = (auditedRows.length - mismatchCount).toLocaleString('ko-KR');

    renderTable();

    // Notify Dashboard
    if (typeof VatDashboard !== 'undefined' && VatDashboard.update) {
      VatDashboard.update(auditedRows);
    }
  }

  // --------------------------------------------------------------------------
  // Table Rendering with Filters
  // --------------------------------------------------------------------------
  function renderTable() {
    let rowsToRender = auditedRows;
    if (currentFilter === 'mismatch') {
      rowsToRender = auditedRows.filter(r => r.status !== 'match');
    } else if (currentFilter === 'match') {
      rowsToRender = auditedRows.filter(r => r.status === 'match');
    }

    if (rowsToRender.length === 0) {
      excelTableBody.innerHTML = `<tr><td colspan="9" class="empty-state">해당 조건에 일치하는 데이터가 없습니다.</td></tr>`;
      return;
    }

    excelTableBody.innerHTML = rowsToRender.map(r => {
      let badgeHtml = '';
      let rowClass = '';

      if (r.status === 'match') {
        badgeHtml = `<span class="badge-status match">일치 (정상)</span>`;
      } else {
        rowClass = 'row-mismatch';
        if (r.status === 'diff-vat') {
          badgeHtml = `<span class="badge-status diff-vat">세액 불일치</span>`;
        } else if (r.status === 'diff-total') {
          badgeHtml = `<span class="badge-status diff-total">합계 불일치</span>`;
        } else {
          badgeHtml = `<span class="badge-status diff-both">세액·합계 불일치</span>`;
        }
      }

      return `
        <tr class="${rowClass}">
          <td class="text-center">${r.index}</td>
          <td><strong>${escapeHtml(r.itemName)}</strong></td>
          <td class="text-right">${r.rawSupply !== null ? r.rawSupply.toLocaleString('ko-KR') : '-'}</td>
          <td class="text-right text-danger">${r.rawVat !== null ? r.rawVat.toLocaleString('ko-KR') : '-'}</td>
          <td class="text-right"><strong>${r.calcVat.toLocaleString('ko-KR')}</strong></td>
          <td class="text-right">${r.rawTotal !== null ? r.rawTotal.toLocaleString('ko-KR') : '-'}</td>
          <td class="text-right text-primary"><strong>${r.calcTotal.toLocaleString('ko-KR')}</strong></td>
          <td class="text-center">${badgeHtml}</td>
          <td><span style="font-size:0.78rem; color:${r.status === 'match' ? '#15803d' : '#dc2626'}">${r.diffDesc}</span></td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Filter Pill Listeners
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderTable();
    });
  });

  // --------------------------------------------------------------------------
  // Batch Recalculation Tools
  // --------------------------------------------------------------------------
  btnRecalcFromSupply.addEventListener('click', () => {
    if (!auditedRows || auditedRows.length === 0) return;
    const vatKey = colMapVat.value || '부가세(계산)';
    const totalKey = colMapTotal.value || '합계금액(계산)';

    auditedRows.forEach(r => {
      r.originalRow[vatKey] = r.calcVat;
      r.originalRow[totalKey] = r.calcTotal;
    });

    if (!colMapVat.value) {
      colMapVat.value = vatKey;
    }
    if (!colMapTotal.value) {
      colMapTotal.value = totalKey;
    }

    runAudit();
    alert('공급가액 기준으로 부가세액 및 합계금액을 일괄 재계산하여 동기화했습니다.');
  });

  btnRecalcFromTotal.addEventListener('click', () => {
    if (!auditedRows || auditedRows.length === 0) return;
    const supplyKey = colMapSupply.value || '공급가액(계산)';
    const vatKey = colMapVat.value || '부가세(계산)';
    const totalKey = colMapTotal.value;

    if (!totalKey) {
      alert('합계금액(공급대가) 열을 먼저 매핑해주세요.');
      return;
    }

    const rounding = excelRoundingMode.value;

    auditedRows.forEach(r => {
      const tot = cleanNumber(r.originalRow[totalKey]);
      const res = VatCalculator.calculateFromTotal({ total: tot, taxType: 'general', rounding });
      r.originalRow[supplyKey] = res.supply;
      r.originalRow[vatKey] = res.vat;
    });

    if (!colMapSupply.value) {
      colMapSupply.value = supplyKey;
    }
    if (!colMapVat.value) {
      colMapVat.value = vatKey;
    }

    runAudit();
    alert('합계금액(결제액) 기준으로 공급가액 및 세액을 일괄 역산하여 동기화했습니다.');
  });

  // --------------------------------------------------------------------------
  // Export Audited Results to Excel (.xlsx)
  // --------------------------------------------------------------------------
  btnExportAuditedExcel.addEventListener('click', () => {
    if (!auditedRows || auditedRows.length === 0) {
      alert('내보낼 대사 데이터가 없습니다.');
      return;
    }

    const exportData = auditedRows.map(r => {
      return {
        'No': r.index,
        '품목명': r.itemName,
        '엑셀_공급가액': r.rawSupply !== null ? r.rawSupply : '',
        '엑셀_부가세액': r.rawVat !== null ? r.rawVat : '',
        '계산_부가세액': r.calcVat,
        '엑셀_합계금액': r.rawTotal !== null ? r.rawTotal : '',
        '계산_합계금액': r.calcTotal,
        '대사상태': r.status === 'match' ? '정상일치' : '불일치',
        '오차상세': r.diffDesc,
        ...r.originalRow
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '부가세대사결과');

    const fileName = `부가세_대사결과_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  });

  // --------------------------------------------------------------------------
  // Download Sample Excel Template
  // --------------------------------------------------------------------------
  btnDownloadSample.addEventListener('click', () => {
    const sampleData = [
      { '품목명': '사무용 데스크탑', '공급가액': 1200000, '부가세': 120000, '합계금액': 1320000, '비고': '정상 건' },
      { '품목명': '모니터 27인치 (오차 테스트)', '공급가액': 255555, '부가세': 25550, '합계금액': 281105, '비고': '세액 5원 차이 오차 건' },
      { '품목명': '기계식 키보드', '공급가액': 85000, '부가세': 8500, '합계금액': 93500, '비고': '정상 건' },
      { '품목명': '복사용지 A4 박스', '공급가액': 32400, '부가세': 3240, '합계금액': 35640, '비고': '정상 건' },
      { '품목명': '법인차량 주유대금 (합계 오차)', '공급가액': 50000, '부가세': 5000, '합계금액': 56000, '비고': '합계 불일치 건' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '거래샘플');
    XLSX.writeFile(workbook, '부가세_대사_샘플템플릿.xlsx');
  });

  // --------------------------------------------------------------------------
  // External Data Load Event (e.g., from Dashboard)
  // --------------------------------------------------------------------------
  window.addEventListener('vat:loadExternalData', (e) => {
    const detail = e.detail;
    if (!detail) return;

    excelFileName.textContent = detail.fileName;
    currentWorkbook = detail.workbook;
    excelSheetSelect.innerHTML = `<option value="${detail.sheetName}">${detail.sheetName}</option>`;
    
    currentSheetData = detail.rawJson;
    excelRowCount.textContent = `${currentSheetData.length.toLocaleString('ko-KR')}건`;

    sheetColumns = Object.keys(currentSheetData[0]);
    populateColumnSelects(sheetColumns);
    autoDetectColumns(sheetColumns);

    dropZone.classList.add('hidden');
    excelControlSection.classList.remove('hidden');

    runAudit();
  });

})();
