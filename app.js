/**
 * 부가세 계산기 애플리케이션 UI 제어 및 이벤트 바인딩
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Inputs & Controls
  const taxTypeRadios = document.querySelectorAll('input[name="taxType"]');
  const simplifiedSubGroup = document.getElementById('simplifiedSubGroup');
  const simplifiedRateSelect = document.getElementById('simplifiedRate');
  const roundingRadios = document.querySelectorAll('input[name="rounding"]');
  const hasTipCheckbox = document.getElementById('hasTip');
  const nonDeductibleCheckbox = document.getElementById('nonDeductible');
  const tipInputGroup = document.getElementById('tipInputGroup');
  const tipInput = document.getElementById('tipInput');

  const supplyInput = document.getElementById('supplyInput');
  const totalInput = document.getElementById('totalInput');
  const supplyKorean = document.getElementById('supplyKorean');
  const totalKorean = document.getElementById('totalKorean');

  // Quick Action Buttons
  const quickBtns = document.querySelectorAll('.btn-chip[data-add]');
  const btnToggleSign = document.getElementById('btnToggleSign');
  const btnReset = document.getElementById('btnReset');

  // DOM Elements - Result Summary
  const resSupply = document.getElementById('resSupply');
  const resTipRow = document.getElementById('resTipRow');
  const resTip = document.getElementById('resTip');
  const resTaxRateLabel = document.getElementById('resTaxRateLabel');
  const resTaxTag = document.getElementById('resTaxTag');
  const resVat = document.getElementById('resVat');
  const resTotal = document.getElementById('resTotal');
  const resTotalKorean = document.getElementById('resTotalKorean');
  const nonDeductibleBanner = document.getElementById('nonDeductibleBanner');

  // Preview Table
  const tableSupply = document.getElementById('tableSupply');
  const tableVat = document.getElementById('tableVat');
  const tableTotal = document.getElementById('tableTotal');
  const invoiceFormula = document.getElementById('invoiceFormula');

  // Action Buttons
  const btnCopyText = document.getElementById('btnCopyText');
  const btnCopyInvoice = document.getElementById('btnCopyInvoice');
  const btnSaveHistory = document.getElementById('btnSaveHistory');
  const toast = document.getElementById('toast');

  // Mixed Tab Elements
  const mixedTaxableInput = document.getElementById('mixedTaxableInput');
  const mixedTaxFreeInput = document.getElementById('mixedTaxFreeInput');
  const mixedResTaxable = document.getElementById('mixedResTaxable');
  const mixedResTaxFree = document.getElementById('mixedResTaxFree');
  const mixedResVat = document.getElementById('mixedResVat');
  const mixedResTotal = document.getElementById('mixedResTotal');
  const btnCopyMixed = document.getElementById('btnCopyMixed');

  // History Tab Elements
  const historyTableBody = document.getElementById('historyTableBody');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // Navigation Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Current State
  let lastActiveInput = 'supply'; // 'supply' or 'total'
  let latestResult = null;
  const HISTORY_STORAGE_KEY = 'vat_calc_history_v1';

  // --------------------------------------------------------------------------
  // Tab Switching
  // --------------------------------------------------------------------------
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTabId = `tab-${btn.dataset.tab}`;
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (btn.dataset.tab === 'history') {
        renderHistory();
      }
    });
  });

  // --------------------------------------------------------------------------
  // Helper: Get Current Options
  // --------------------------------------------------------------------------
  function getOptions() {
    const taxType = document.querySelector('input[name="taxType"]:checked')?.value || 'general';
    const rounding = document.querySelector('input[name="rounding"]:checked')?.value || 'round';
    const simplifiedRate = parseFloat(simplifiedRateSelect.value) || 0.15;
    const hasTip = hasTipCheckbox.checked;
    const tip = hasTip ? VatCalculator.parseInputNumber(tipInput.value) : 0;
    const isNonDeductible = nonDeductibleCheckbox.checked;

    return { taxType, rounding, simplifiedRate, tip, hasTip, isNonDeductible };
  }

  // --------------------------------------------------------------------------
  // Recalculate Logic
  // --------------------------------------------------------------------------
  function updateCalculation() {
    const opts = getOptions();

    // Toggle conditional UI elements
    simplifiedSubGroup.classList.toggle('hidden', opts.taxType !== 'simplified');
    tipInputGroup.classList.toggle('hidden', !opts.hasTip);
    resTipRow.style.display = opts.hasTip ? 'flex' : 'none';
    nonDeductibleBanner.classList.toggle('hidden', !opts.isNonDeductible);

    // Update tax tag label
    const taxTypeNames = {
      general: '일반과세 (10%)',
      zero: '영세율 (0%)',
      taxfree: '면세 (비과세)',
      simplified: '간이과세'
    };
    resTaxTag.textContent = taxTypeNames[opts.taxType] || '일반과세';

    if (lastActiveInput === 'supply') {
      const supplyVal = VatCalculator.parseInputNumber(supplyInput.value);
      latestResult = VatCalculator.calculateFromSupply({
        supply: supplyVal,
        taxType: opts.taxType,
        simplifiedRate: opts.simplifiedRate,
        rounding: opts.rounding,
        tip: opts.tip
      });
      // Synchronize Total field
      totalInput.value = VatCalculator.formatNumber(latestResult.total);
    } else {
      const totalVal = VatCalculator.parseInputNumber(totalInput.value);
      latestResult = VatCalculator.calculateFromTotal({
        total: totalVal,
        taxType: opts.taxType,
        simplifiedRate: opts.simplifiedRate,
        rounding: opts.rounding,
        tip: opts.tip
      });
      // Synchronize Supply field
      supplyInput.value = VatCalculator.formatNumber(latestResult.supply);
    }

    // Update Summary UI
    resSupply.textContent = `${VatCalculator.formatNumber(latestResult.supply)} 원`;
    resTip.textContent = `${VatCalculator.formatNumber(latestResult.tip)} 원`;
    resTaxRateLabel.textContent = latestResult.rateLabel;
    resVat.textContent = `${VatCalculator.formatNumber(latestResult.vat)} 원`;
    resTotal.textContent = `${VatCalculator.formatNumber(latestResult.total)} 원`;
    resTotalKorean.textContent = VatCalculator.toKoreanAmount(latestResult.total);

    // Update Korean Text beneath inputs
    supplyKorean.textContent = VatCalculator.toKoreanAmount(latestResult.supply);
    totalKorean.textContent = VatCalculator.toKoreanAmount(latestResult.total);

    // Update Table Preview
    tableSupply.textContent = VatCalculator.formatNumber(latestResult.supply);
    tableVat.textContent = VatCalculator.formatNumber(latestResult.vat);
    tableTotal.textContent = VatCalculator.formatNumber(latestResult.total);

    // Update Formula description
    if (opts.taxType === 'general') {
      invoiceFormula.textContent = `단수처리: ${getRoundingLabel(opts.rounding)} | 공식: 공급가액 × 10% = 세액`;
    } else if (opts.taxType === 'zero') {
      invoiceFormula.textContent = '영세율 적용 (세율 0%)';
    } else if (opts.taxType === 'taxfree') {
      invoiceFormula.textContent = '부가가치세 면세 품목 (비과세 대상)';
    } else {
      invoiceFormula.textContent = `간이과세 부가가치율 ${(opts.simplifiedRate * 100).toFixed(0)}% 적용`;
    }
  }

  function getRoundingLabel(roundingKey) {
    switch (roundingKey) {
      case 'floor': return '원단위 절사(버림)';
      case 'taxFloor10': return '국세법 10원 미만 절사';
      case 'ceil': return '올림';
      case 'round':
      default: return '표준 반올림';
    }
  }

  // --------------------------------------------------------------------------
  // Input Event Handlers
  // --------------------------------------------------------------------------
  supplyInput.addEventListener('focus', () => {
    lastActiveInput = 'supply';
  });

  supplyInput.addEventListener('input', (e) => {
    lastActiveInput = 'supply';
    const num = VatCalculator.parseInputNumber(e.target.value);
    e.target.value = VatCalculator.formatNumber(num);
    updateCalculation();
  });

  totalInput.addEventListener('focus', () => {
    lastActiveInput = 'total';
  });

  totalInput.addEventListener('input', (e) => {
    lastActiveInput = 'total';
    const num = VatCalculator.parseInputNumber(e.target.value);
    e.target.value = VatCalculator.formatNumber(num);
    updateCalculation();
  });

  tipInput.addEventListener('input', (e) => {
    const num = VatCalculator.parseInputNumber(e.target.value);
    e.target.value = VatCalculator.formatNumber(num);
    updateCalculation();
  });

  // Radio and Checkbox changes
  taxTypeRadios.forEach(r => r.addEventListener('change', () => {
    // UI active class on pill
    document.querySelectorAll('#taxTypeGroup .pill').forEach(p => p.classList.remove('active'));
    r.closest('.pill').classList.add('active');
    updateCalculation();
  }));

  simplifiedRateSelect.addEventListener('change', updateCalculation);
  roundingRadios.forEach(r => r.addEventListener('change', updateCalculation));
  hasTipCheckbox.addEventListener('change', updateCalculation);
  nonDeductibleCheckbox.addEventListener('change', updateCalculation);

  // --------------------------------------------------------------------------
  // Quick Action Buttons
  // --------------------------------------------------------------------------
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const addVal = parseInt(btn.dataset.add, 10);
      const targetInput = (lastActiveInput === 'total') ? totalInput : supplyInput;
      const currentVal = VatCalculator.parseInputNumber(targetInput.value);
      targetInput.value = VatCalculator.formatNumber(currentVal + addVal);
      updateCalculation();
    });
  });

  btnToggleSign.addEventListener('click', () => {
    const targetInput = (lastActiveInput === 'total') ? totalInput : supplyInput;
    const currentVal = VatCalculator.parseInputNumber(targetInput.value);
    targetInput.value = VatCalculator.formatNumber(currentVal * -1);
    updateCalculation();
  });

  btnReset.addEventListener('click', () => {
    supplyInput.value = '0';
    totalInput.value = '0';
    tipInput.value = '0';
    lastActiveInput = 'supply';
    updateCalculation();
  });

  // --------------------------------------------------------------------------
  // Clipboard Copy & Toast
  // --------------------------------------------------------------------------
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  btnCopyText.addEventListener('click', () => {
    if (!latestResult) return;
    const text = [
      `[부가가치세 계산 결과]`,
      `- 공급가액: ${VatCalculator.formatNumber(latestResult.supply)}원`,
      latestResult.tip > 0 ? `- 비과세 봉사료: ${VatCalculator.formatNumber(latestResult.tip)}원` : null,
      `- 부가가치세(${latestResult.rateLabel}): ${VatCalculator.formatNumber(latestResult.vat)}원`,
      `- 총 합계금액: ${VatCalculator.formatNumber(latestResult.total)}원 (${VatCalculator.toKoreanAmount(latestResult.total)})`,
      `- 단수처리: ${getRoundingLabel(latestResult.rounding)}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showToast('요약 결과가 클립보드에 복사되었습니다.');
    }).catch(() => {
      fallbackCopy(text);
    });
  });

  btnCopyInvoice.addEventListener('click', () => {
    if (!latestResult) return;
    const tsv = [
      `구분\t공급가액\t세액\t합계금액`,
      `세금계산서\t${latestResult.supply}\t${latestResult.vat}\t${latestResult.total}`
    ].join('\n');

    navigator.clipboard.writeText(tsv).then(() => {
      showToast('엑셀/스프레드시트용 표가 복사되었습니다.');
    }).catch(() => {
      fallbackCopy(tsv);
    });
  });

  function fallbackCopy(text) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('복사되었습니다.');
  }

  // --------------------------------------------------------------------------
  // Mixed Mode (과세 + 면세 복합 계산)
  // --------------------------------------------------------------------------
  function updateMixedCalculation() {
    const taxable = VatCalculator.parseInputNumber(mixedTaxableInput.value);
    const taxFree = VatCalculator.parseInputNumber(mixedTaxFreeInput.value);

    // Standard VAT for taxable portion (10% rounded)
    const vat = Math.round(taxable * 0.1);
    const total = taxable + vat + taxFree;

    mixedResTaxable.textContent = `${VatCalculator.formatNumber(taxable)} 원`;
    mixedResTaxFree.textContent = `${VatCalculator.formatNumber(taxFree)} 원`;
    mixedResVat.textContent = `${VatCalculator.formatNumber(vat)} 원`;
    mixedResTotal.textContent = `${VatCalculator.formatNumber(total)} 원`;
  }

  mixedTaxableInput.addEventListener('input', (e) => {
    const num = VatCalculator.parseInputNumber(e.target.value);
    e.target.value = VatCalculator.formatNumber(num);
    updateMixedCalculation();
  });

  mixedTaxFreeInput.addEventListener('input', (e) => {
    const num = VatCalculator.parseInputNumber(e.target.value);
    e.target.value = VatCalculator.formatNumber(num);
    updateMixedCalculation();
  });

  btnCopyMixed.addEventListener('click', () => {
    const taxable = VatCalculator.parseInputNumber(mixedTaxableInput.value);
    const taxFree = VatCalculator.parseInputNumber(mixedTaxFreeInput.value);
    const vat = Math.round(taxable * 0.1);
    const total = taxable + vat + taxFree;

    const text = [
      `[과세·면세 복합 계산서]`,
      `- 과세 공급가액: ${VatCalculator.formatNumber(taxable)}원`,
      `- 면세 공급가액: ${VatCalculator.formatNumber(taxFree)}원`,
      `- 부가가치세(10%): ${VatCalculator.formatNumber(vat)}원`,
      `- 총 결제금액: ${VatCalculator.formatNumber(total)}원 (${VatCalculator.toKoreanAmount(total)})`
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showToast('복합 계산 결과가 복사되었습니다.');
    });
  });

  // --------------------------------------------------------------------------
  // History Management (LocalStorage)
  // --------------------------------------------------------------------------
  function getStoredHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveHistoryItem(item) {
    const history = getStoredHistory();
    history.unshift(item);
    if (history.length > 50) history.pop(); // keep 50
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }

  btnSaveHistory.addEventListener('click', () => {
    if (!latestResult || latestResult.total === 0) {
      showToast('저장할 금액 데이터가 없습니다.');
      return;
    }
    const item = {
      id: Date.now(),
      date: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      taxType: latestResult.taxType,
      rounding: latestResult.rounding,
      supply: latestResult.supply,
      vat: latestResult.vat,
      total: latestResult.total
    };
    saveHistoryItem(item);
    showToast('계산 이력이 저장되었습니다.');
  });

  function renderHistory() {
    const list = getStoredHistory();
    if (!list || list.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">저장된 계산 이력이 없습니다.</td></tr>';
      return;
    }

    historyTableBody.innerHTML = list.map(item => `
      <tr>
        <td>${item.date}</td>
        <td><span class="badge-sm">${item.taxType}</span></td>
        <td>${getRoundingLabel(item.rounding)}</td>
        <td>${VatCalculator.formatNumber(item.supply)}원</td>
        <td class="text-danger">${VatCalculator.formatNumber(item.vat)}원</td>
        <td><strong>${VatCalculator.formatNumber(item.total)}원</strong></td>
        <td>
          <button type="button" class="btn btn-sm btn-outline apply-history-btn" data-supply="${item.supply}">불러오기</button>
        </td>
      </tr>
    `).join('');

    // Bind apply buttons
    document.querySelectorAll('.apply-history-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const supply = btn.dataset.supply;
        supplyInput.value = VatCalculator.formatNumber(supply);
        lastActiveInput = 'supply';
        // Switch to single tab
        document.querySelector('.tab-btn[data-tab="single"]').click();
        updateCalculation();
        showToast('금액을 불러왔습니다.');
      });
    });
  }

  btnClearHistory.addEventListener('click', () => {
    if (confirm('저장된 계산 이력을 모두 삭제하시겠습니까?')) {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      renderHistory();
      showToast('이력이 모두 삭제되었습니다.');
    }
  });

  // Initial Calculation Run
  supplyInput.value = '1,000,000';
  updateCalculation();
});
