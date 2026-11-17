/**
 * 정밀 부가가치세 연산 코어 모듈 (VAT Core Calculator)
 */
const VatCalculator = (function () {
  /**
   * 단수처리 함수
   * @param {number} val - 대상 실수
   * @param {string} mode - 'round' | 'floor' | 'taxFloor10' | 'ceil'
   * @returns {number}
   */
  function applyRounding(val, mode) {
    if (isNaN(val)) return 0;
    const sign = val < 0 ? -1 : 1;
    const absVal = Math.abs(val);

    let res = 0;
    switch (mode) {
      case 'floor':
        res = Math.floor(absVal);
        break;
      case 'ceil':
        res = Math.ceil(absVal);
        break;
      case 'taxFloor10':
        // 국세징수법 제74조: 10원 미만 절사 (1원 단위 버림)
        res = Math.floor(absVal / 10) * 10;
        break;
      case 'round':
      default:
        // 일반 세무 표준 반올림 (사사오입)
        res = Math.round(absVal);
        break;
    }
    return res * sign;
  }

  /**
   * 공급가액 기준 정방향 계산
   * @param {Object} params
   * @param {number} params.supply - 공급가액
   * @param {string} params.taxType - 'general' | 'zero' | 'taxfree' | 'simplified'
   * @param {number} [params.simplifiedRate] - 간이과세 부가가치율 (기본 0.15)
   * @param {string} params.rounding - 'round' | 'floor' | 'taxFloor10' | 'ceil'
   * @param {number} [params.tip] - 비과세 봉사료 (기본 0)
   * @returns {Object}
   */
  function calculateFromSupply({ supply, taxType, simplifiedRate = 0.15, rounding = 'round', tip = 0 }) {
    const s = Math.round(supply);
    const t = Math.round(tip);

    let rate = 0.1;
    let rateLabel = '10%';
    let isZeroTax = false;

    if (taxType === 'zero') {
      rate = 0;
      rateLabel = '0% (영세율)';
      isZeroTax = true;
    } else if (taxType === 'taxfree') {
      rate = 0;
      rateLabel = '면세 (비과세)';
      isZeroTax = true;
    } else if (taxType === 'simplified') {
      rate = simplifiedRate * 0.1;
      rateLabel = `${(rate * 100).toFixed(1)}% (간이)`;
    }

    const rawVat = isZeroTax ? 0 : s * rate;
    const vat = isZeroTax ? 0 : applyRounding(rawVat, rounding);
    const total = s + vat + t;

    return {
      supply: s,
      vat,
      tip: t,
      total,
      rate,
      rateLabel,
      taxType,
      rounding
    };
  }

  /**
   * 합계금액(공급대가) 기준 역산 계산
   * @param {Object} params
   * @param {number} params.total - 합계금액
   * @param {string} params.taxType - 'general' | 'zero' | 'taxfree' | 'simplified'
   * @param {number} [params.simplifiedRate] - 간이과세 부가가치율 (기본 0.15)
   * @param {string} params.rounding - 'round' | 'floor' | 'taxFloor10' | 'ceil'
   * @param {number} [params.tip] - 비과세 봉사료 (기본 0)
   * @returns {Object}
   */
  function calculateFromTotal({ total, taxType, simplifiedRate = 0.15, rounding = 'round', tip = 0 }) {
    const tot = Math.round(total);
    const t = Math.round(tip);
    const taxableTotal = tot - t;

    let rate = 0.1;
    let rateLabel = '10%';
    let isZeroTax = false;

    if (taxType === 'zero') {
      rate = 0;
      rateLabel = '0% (영세율)';
      isZeroTax = true;
    } else if (taxType === 'taxfree') {
      rate = 0;
      rateLabel = '면세 (비과세)';
      isZeroTax = true;
    } else if (taxType === 'simplified') {
      rate = simplifiedRate * 0.1;
      rateLabel = `${(rate * 100).toFixed(1)}% (간이)`;
    }

    let supply = 0;
    let vat = 0;

    if (isZeroTax) {
      supply = taxableTotal;
      vat = 0;
    } else {
      // 일반 세무 역산 공식: 공급가액 = 합계 / (1 + 세율)
      // 세액 = 합계 - 공급가액 (1원 단위 합계 불일치 방지)
      const rawSupply = taxableTotal / (1 + rate);
      supply = applyRounding(rawSupply, rounding);
      vat = taxableTotal - supply;
    }

    return {
      supply,
      vat,
      tip: t,
      total: tot,
      rate,
      rateLabel,
      taxType,
      rounding
    };
  }

  /**
   * 숫자를 한글 금액 표기로 변환
   * @param {number} num - 대상 정수
   * @returns {string} - 예: "일백이십삼만사천오백 원"
   */
  function toKoreanAmount(num) {
    if (num === 0 || isNaN(num)) return '영 원';

    const isMinus = num < 0;
    let n = Math.abs(num);

    const units = ['', '만', '억', '조', '경'];
    const subUnits = ['', '십', '백', '천'];
    const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

    let result = '';
    let unitIdx = 0;

    while (n > 0) {
      const part = n % 10000;
      if (part > 0) {
        let partStr = '';
        let p = part;
        for (let i = 0; i < 4; i++) {
          const d = p % 10;
          if (d > 0) {
            partStr = digits[d] + subUnits[i] + partStr;
          }
          p = Math.floor(p / 10);
        }
        result = partStr + units[unitIdx] + (result ? ' ' + result : '');
      }
      n = Math.floor(n / 10000);
      unitIdx++;
    }

    return (isMinus ? '마이너스 ' : '') + result + ' 원';
  }

  /**
   * 천단위 콤마 포맷터
   * @param {number|string} val
   * @returns {string}
   */
  function formatNumber(val) {
    if (val === null || val === undefined || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('ko-KR');
  }

  /**
   * 입력 문자열에서 콤마 및 비숫자 제거 (음수 부호 허용)
   * @param {string} str
   * @returns {number}
   */
  function parseInputNumber(str) {
    if (!str) return 0;
    const cleanStr = String(str).replace(/[^\d-]/g, '');
    const num = parseInt(cleanStr, 10);
    return isNaN(num) ? 0 : num;
  }

  return {
    calculateFromSupply,
    calculateFromTotal,
    applyRounding,
    toKoreanAmount,
    formatNumber,
    parseInputNumber
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VatCalculator;
}
