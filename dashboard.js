/**
 * 부가세 및 전표 통계 시각화 대시보드 모듈 (Chart.js 기반)
 */
const VatDashboard = (function () {
  // Chart instances
  let chartMonthlyTrendInstance = null;
  let chartTopVendorsInstance = null;
  let chartItemShareInstance = null;
  let chartAuditStatusInstance = null;

  // DOM Elements
  const dashEmptyState = document.getElementById('dashEmptyState');
  const dashContentSection = document.getElementById('dashContentSection');
  const btnLoadSampleToDashboard = document.getElementById('btnLoadSampleToDashboard');

  // KPI DOM Elements
  const kpiCount = document.getElementById('kpiCount');
  const kpiSumSupply = document.getElementById('kpiSumSupply');
  const kpiSumVat = document.getElementById('kpiSumVat');
  const kpiSumTotal = document.getElementById('kpiSumTotal');
  const kpiAvgSupply = document.getElementById('kpiAvgSupply');
  const kpiErrorRate = document.getElementById('kpiErrorRate');

  // Claude Design System Palette
  const COLORS = {
    primary: '#cc785c',            // signature warm coral
    primaryLight: 'rgba(204, 120, 92, 0.75)',
    primaryActive: '#a9583e',
    ink: '#141413',
    surfaceDark: '#181715',
    accentTeal: '#5db8a6',
    accentAmber: '#e8a55a',
    success: '#5db872',
    warning: '#d4a017',
    error: '#c64545',
    palette: [
      '#cc785c', '#5db8a6', '#e8a55a', '#181715', '#8b5cf6',
      '#5db872', '#a09d96', '#d4a017', '#c64545', '#3d3d3a'
    ]
  };

  /**
   * 대시보드 업데이트 진입점
   * @param {Array} rows - excel.js에서 가공된 auditedRows 리스트
   */
  function update(rows) {
    if (!rows || rows.length === 0) {
      if (dashEmptyState) dashEmptyState.classList.remove('hidden');
      if (dashContentSection) dashContentSection.classList.add('hidden');
      destroyCharts();
      return;
    }

    if (dashEmptyState) dashEmptyState.classList.add('hidden');
    if (dashContentSection) dashContentSection.classList.remove('hidden');

    renderKPIs(rows);
    renderMonthlyChart(rows);
    renderTopVendorsChart(rows);
    renderItemShareChart(rows);
    renderAuditStatusChart(rows);
  }

  function destroyCharts() {
    if (chartMonthlyTrendInstance) {
      chartMonthlyTrendInstance.destroy();
      chartMonthlyTrendInstance = null;
    }
    if (chartTopVendorsInstance) {
      chartTopVendorsInstance.destroy();
      chartTopVendorsInstance = null;
    }
    if (chartItemShareInstance) {
      chartItemShareInstance.destroy();
      chartItemShareInstance = null;
    }
    if (chartAuditStatusInstance) {
      chartAuditStatusInstance.destroy();
      chartAuditStatusInstance = null;
    }
  }

  // --------------------------------------------------------------------------
  // KPI Metrics Calculation
  // --------------------------------------------------------------------------
  function renderKPIs(rows) {
    const totalCount = rows.length;
    let sumSupply = 0;
    let sumVat = 0;
    let sumTotal = 0;
    let mismatchCount = 0;

    rows.forEach(r => {
      const s = r.rawSupply !== null ? r.rawSupply : 0;
      const v = r.calcVat !== null ? r.calcVat : 0;
      const t = r.calcTotal !== null ? r.calcTotal : 0;
      sumSupply += s;
      sumVat += v;
      sumTotal += t;
      if (r.status !== 'match') mismatchCount++;
    });

    const avgSupply = totalCount > 0 ? Math.round(sumSupply / totalCount) : 0;
    const errorRate = totalCount > 0 ? ((mismatchCount / totalCount) * 100).toFixed(2) : '0.00';

    kpiCount.textContent = `${totalCount.toLocaleString('ko-KR')} 건`;
    kpiSumSupply.textContent = `${sumSupply.toLocaleString('ko-KR')} 원`;
    kpiSumVat.textContent = `${sumVat.toLocaleString('ko-KR')} 원`;
    kpiSumTotal.textContent = `${sumTotal.toLocaleString('ko-KR')} 원`;
    kpiAvgSupply.textContent = `${avgSupply.toLocaleString('ko-KR')} 원`;
    kpiErrorRate.textContent = `${errorRate}% (${mismatchCount.toLocaleString('ko-KR')}건)`;
  }

  // --------------------------------------------------------------------------
  // Chart 1: Monthly/Periodic Trend
  // --------------------------------------------------------------------------
  function renderMonthlyChart(rows) {
    const ctx = document.getElementById('chartMonthlyTrend');
    if (!ctx) return;
    if (chartMonthlyTrendInstance) chartMonthlyTrendInstance.destroy();

    // Group by month from originalRow '거래일자' or fallback to pseudo buckets
    const monthlyMap = {};

    rows.forEach(r => {
      const dateStr = r.originalRow['거래일자'] || r.originalRow['일자'] || r.originalRow['날짜'] || '';
      let monthKey = '미지정';
      if (dateStr && dateStr.length >= 7) {
        monthKey = dateStr.slice(0, 7); // 'YYYY-MM'
      } else {
        // Fallback: 5 equal chunks
        const chunkIdx = Math.floor((r.index - 1) / (rows.length / 4 || 1)) + 1;
        monthKey = `구간 ${chunkIdx}`;
      }

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { supply: 0, vat: 0 };
      }
      monthlyMap[monthKey].supply += (r.rawSupply || 0);
      monthlyMap[monthKey].vat += (r.calcVat || 0);
    });

    const sortedLabels = Object.keys(monthlyMap).sort();
    const supplyData = sortedLabels.map(k => Math.round(monthlyMap[k].supply / 10000)); // 만원 단위
    const vatData = sortedLabels.map(k => Math.round(monthlyMap[k].vat / 10000));

    chartMonthlyTrendInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedLabels,
        datasets: [
          {
            type: 'bar',
            label: '공급가액 (만원)',
            data: supplyData,
            backgroundColor: 'rgba(204, 120, 92, 0.65)',
            borderColor: COLORS.primary,
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: '부가가치세 (만원)',
            data: vatData,
            borderColor: COLORS.surfaceDark,
            backgroundColor: 'rgba(24, 23, 21, 0.75)',
            borderWidth: 2,
            tension: 0.2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: '공급가액 (만원)' },
            ticks: {
              callback: (v) => v.toLocaleString('ko-KR')
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: '부가세 (만원)' },
            ticks: {
              callback: (v) => v.toLocaleString('ko-KR')
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Chart 2: Top Vendors (수평 바)
  // --------------------------------------------------------------------------
  function renderTopVendorsChart(rows) {
    const ctx = document.getElementById('chartTopVendors');
    if (!ctx) return;
    if (chartTopVendorsInstance) chartTopVendorsInstance.destroy();

    const vendorMap = {};
    rows.forEach(r => {
      const vendor = r.originalRow['거래처명'] || r.originalRow['거래처'] || r.originalRow['상호'] || '기타';
      vendorMap[vendor] = (vendorMap[vendor] || 0) + (r.rawSupply || 0);
    });

    const sorted = Object.entries(vendorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Top 8

    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => Math.round(item[1] / 10000)); // 만원

    chartTopVendorsInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '공급가액 (만원)',
          data: data,
          backgroundColor: '#cc785c',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: {
              callback: (v) => v.toLocaleString('ko-KR')
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Chart 3: Item Category Share (도넛)
  // --------------------------------------------------------------------------
  function renderItemShareChart(rows) {
    const ctx = document.getElementById('chartItemShare');
    if (!ctx) return;
    if (chartItemShareInstance) chartItemShareInstance.destroy();

    const itemMap = {};
    rows.forEach(r => {
      // Simplify item name to first 12 chars
      let name = r.itemName || '기타 품목';
      if (name.length > 14) name = name.slice(0, 14) + '..';
      itemMap[name] = (itemMap[name] || 0) + (r.rawSupply || 0);
    });

    const sorted = Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1]);

    const topItems = sorted.slice(0, 5);
    const otherSum = sorted.slice(5).reduce((acc, cur) => acc + cur[1], 0);

    const labels = topItems.map(i => i[0]);
    const data = topItems.map(i => Math.round(i[1] / 10000));

    if (otherSum > 0) {
      labels.push('기타 항목들');
      data.push(Math.round(otherSum / 10000));
    }

    chartItemShareInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: COLORS.palette
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Chart 4: Audit Reconciliation Status (도넛)
  // --------------------------------------------------------------------------
  function renderAuditStatusChart(rows) {
    const ctx = document.getElementById('chartAuditStatus');
    if (!ctx) return;
    if (chartAuditStatusInstance) chartAuditStatusInstance.destroy();

    let matchCount = 0;
    let diffVatCount = 0;
    let diffTotalCount = 0;
    let diffBothCount = 0;

    rows.forEach(r => {
      if (r.status === 'match') matchCount++;
      else if (r.status === 'diff-vat') diffVatCount++;
      else if (r.status === 'diff-total') diffTotalCount++;
      else if (r.status === 'diff-both') diffBothCount++;
    });

    chartAuditStatusInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['정상 일치', '세액 불일치', '합계 불일치', '세액·합계 복합 불일치'],
        datasets: [{
          data: [matchCount, diffVatCount, diffTotalCount, diffBothCount],
          backgroundColor: [COLORS.success, COLORS.error, COLORS.accentAmber, '#181715']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Load 5,000 Sample CSV via Fetch
  // --------------------------------------------------------------------------
  if (btnLoadSampleToDashboard) {
    btnLoadSampleToDashboard.addEventListener('click', async () => {
      try {
        btnLoadSampleToDashboard.disabled = true;
        btnLoadSampleToDashboard.textContent = '⏳ 5,000건 데이터 로딩 및 분석 중...';

        const resp = await fetch('sample_vat_transactions_5000.csv');
        if (!resp.ok) {
          throw new Error('샘플 CSV 파일을 불러올 수 없습니다. 경로를 확인해주세요.');
        }
        const text = await resp.text();
        
        // Parse CSV using SheetJS
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        // Trigger Excel Module
        if (window.dispatchEvent) {
          const event = new CustomEvent('vat:loadExternalData', {
            detail: {
              fileName: 'sample_vat_transactions_5000.csv',
              workbook: workbook,
              sheetName: sheetName,
              rawJson: rawJson
            }
          });
          window.dispatchEvent(event);
        }

        btnLoadSampleToDashboard.disabled = false;
        btnLoadSampleToDashboard.textContent = '🚀 5,000건 샘플 데이터로 즉시 분석하기';
      } catch (err) {
        console.error('샘플 로딩 실패:', err);
        alert('샘플 데이터를 로드하는 중 오류가 발생했습니다: ' + err.message);
        btnLoadSampleToDashboard.disabled = false;
        btnLoadSampleToDashboard.textContent = '🚀 5,000건 샘플 데이터로 즉시 분석하기';
      }
    });
  }

  return {
    update
  };
})();
