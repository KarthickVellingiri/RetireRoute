const $ = (selector) => document.querySelector(selector);
const formatNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const START_DATE = new Date(2026, 6, 1);
const STORAGE_KEY = 'retireroute-plan-v7';
const RISK_RETURN = 12;
let projectionData = {};

function money(value) { const n = Math.max(0, value || 0); return n >= 1e7 ? `₹${(n / 1e7).toFixed(n >= 1e8 ? 1 : 2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${formatNumber.format(n)}`; }
function number(element) { return +element.value || 0; }
function monthLabel(month) { const date = new Date(START_DATE); date.setMonth(date.getMonth() + month - 1); return date.toLocaleString('en-IN', { month: 'short', year: 'numeric' }); }
function duration(months) { if (!months) return '—'; const years = Math.floor(months / 12), extra = months % 12; return years ? `${years} yr${years === 1 ? '' : 's'}${extra ? ` ${extra} mo` : ''}` : `${extra} months`; }
function ageAt(month) { return (number($('#currentAge')) + month / 12).toFixed(1); }

function addRow(type, values = {}) { const row = $(`#${type}Template`).content.firstElementChild.cloneNode(true); Object.entries(values).forEach(([key, value]) => { const input = row.querySelector(`.${key}`); if (input) input.value = value; }); row.querySelector('.remove').onclick = () => { row.remove(); refresh(); }; row.querySelectorAll('input').forEach(input => input.addEventListener('input', refresh)); $(`#${type}Rows`).append(row); }
function rows(type) { return [...$(`#${type}Rows`).querySelectorAll('tr')]; }
function investments() { return rows('investment').map(row => ({ name: row.querySelector('.name').value, amount: number(row.querySelector('.amount')), rate: number(row.querySelector('.rate')) })); }
function loans() { return rows('loan').map((row, index) => { const principal = number(row.querySelector('.principal')), rate = number(row.querySelector('.rate')), tenure = number(row.querySelector('.tenure')); const r = rate / 1200; const emi = tenure ? (r ? principal * r / (1 - Math.pow(1 + r, -tenure)) : principal / tenure) : number(row.querySelector('.emi')); return { id: `L${index + 1}`, name: row.querySelector('.name').value, principal, rate, emi, tenure }; }).filter(loan => loan.principal > 0); }
function monthlySip(month) { return number($('#sip')) * Math.pow(1 + number($('#sipIncrease')) / 100, Math.floor((month - 1) / 12)); }
function annualBonus(month) { const date = new Date(START_DATE); date.setMonth(date.getMonth() + month - 1); return date.getMonth() + 1 === number($('#bonusMonth')) ? number($('#annualBonus')) : 0; }
function targetAt(month) { return number($('#corpus')) * Math.pow(1 + number($('#inflation')) / 1200, month); }
function totalPortfolio(assets) { return assets.reduce((sum, asset) => sum + asset.value, 0); }
function totalDebt(loanList) { return loanList.reduce((sum, loan) => sum + loan.balance, 0); }
function growAssets(assets) { assets.forEach(asset => { asset.value *= 1 + asset.rate / 1200; }); }
function growLoans(loanList) { loanList.forEach(loan => { if (loan.balance > 0.005) loan.balance *= 1 + loan.rate / 1200; }); }
function addRiskContribution(assets, amount) {
  const riskAssets = assets.filter(asset => asset.rate === RISK_RETURN);
  const basis = riskAssets.reduce((sum, asset) => sum + asset.value, 0);
  if (!riskAssets.length) { assets.push({ name: 'New risk investments', value: amount, rate: RISK_RETURN }); return; }
  riskAssets.forEach(asset => { asset.value += amount * (asset.value / basis); });
}
function payScheduled(loanList) { let paid = 0; loanList.forEach(loan => { if (loan.balance <= 0.005) return; const payment = Math.min(loan.emi, loan.balance); loan.balance -= payment; paid += payment; }); return paid; }
function avalanche(loanList, available) { let remaining = available, paid = 0; [...loanList].sort((a, b) => b.rate - a.rate).forEach(loan => { if (remaining <= 0 || loan.balance <= 0.005) return; const payment = Math.min(remaining, loan.balance); loan.balance -= payment; paid += payment; remaining -= payment; }); return { paid, remaining }; }
function snapshot(month, assets, loanList, sip, bonus, invested, loanPayment, milestones) { return { month, date: monthLabel(month), portfolio: totalPortfolio(assets), target: targetAt(month), sip, bonus, invested, loanPayment, loans: loanList.map(loan => ({ id: loan.id, name: loan.name, balance: Math.max(0, loan.balance) })), debt: totalDebt(loanList), milestones: [...milestones] }; }

/* One identical monthly engine powers both paths. Order each month: asset interest, loan interest,
   required loan EMI(s), strategy cash allocation, then target / milestone checks. */
function simulate(path) {
  const assets = investments().map(asset => ({ ...asset, value: asset.amount }));
  const loanList = loans().map(loan => ({ ...loan, balance: loan.principal }));
  const originalTotalEmi = loanList.reduce((sum, loan) => sum + loan.emi, 0);
  const schedule = [];
  const milestones = {};
  let corpusHit = null, debtFree = null;
  for (let month = 1; month <= 1200; month++) {
    growAssets(assets); growLoans(loanList);
    const sip = monthlySip(month), bonus = annualBonus(month);
    const debtBeforePayment = totalDebt(loanList);
    let invested = 0, loanPayment = 0;
    const corpusAlreadyHit = Boolean(corpusHit);
    const debtAlreadyFree = Boolean(debtFree);
    if (path === 'grow') {
      if (!corpusAlreadyHit && !debtAlreadyFree) {
        invested = sip + bonus; addRiskContribution(assets, invested); loanPayment = payScheduled(loanList);
      } else if (!debtAlreadyFree) {
        const scheduledPaid = payScheduled(loanList);
        const extra = sip + bonus + (originalTotalEmi - scheduledPaid);
        const prepayment = avalanche(loanList, extra);
        loanPayment = scheduledPaid + prepayment.paid;
        invested = prepayment.remaining; addRiskContribution(assets, invested);
      } else { invested = sip + bonus + originalTotalEmi; addRiskContribution(assets, invested); }
    } else {
      if (!debtAlreadyFree) {
        const scheduledPaid = payScheduled(loanList);
        const extra = sip + bonus + (originalTotalEmi - scheduledPaid);
        const prepayment = avalanche(loanList, extra);
        loanPayment = scheduledPaid + prepayment.paid;
        invested = prepayment.remaining; addRiskContribution(assets, invested);
      } else { invested = sip + bonus + originalTotalEmi; addRiskContribution(assets, invested); }
    }
    const portfolio = totalPortfolio(assets), target = targetAt(month), debt = totalDebt(loanList);
    const rowMilestones = [];
    if (!corpusHit && portfolio >= target) { corpusHit = month; milestones.corpusHit = snapshot(month, assets, loanList, sip, bonus, invested, loanPayment, ['Corpus hit']); rowMilestones.push('Corpus hit'); }
    if (!debtFree && debtBeforePayment > 0.005 && debt <= 0.005) { debtFree = month; milestones.debtFree = snapshot(month, assets, loanList, sip, bonus, invested, loanPayment, ['Debt-free']); rowMilestones.push('Debt-free'); }
    schedule.push(snapshot(month, assets, loanList, sip, bonus, invested, loanPayment, rowMilestones));
    if (corpusHit && debtFree && portfolio >= target && debt <= 0.005) return { path, finish: month, corpusHit, debtFree, schedule, milestones, finishSnapshot: schedule.at(-1), originalTotalEmi };
  }
  return { path, finish: null, corpusHit, debtFree, schedule, milestones, originalTotalEmi };
}

function projectionCells(row, extraClass = '', hidden = false) { const loansById = Object.fromEntries(row.loans.map(loan => [loan.id, loan.balance])); return `<tr class="${row.milestones.length ? 'milestone-row' : ''} ${extraClass}"${hidden ? ' hidden' : ''}><td>${row.date}${row.milestones.length ? `<small>${row.milestones.join(' · ')}</small>` : ''}</td><td>${money(row.portfolio)}</td><td>${money(row.target)}</td><td>${money(row.sip)} / ${money(row.bonus)} / ${money(row.invested)}</td><td>${money(row.loanPayment)}</td><td>${money(loansById.L1)}</td><td>${money(loansById.L2)}</td><td>${money(loansById.L3)}</td><td>${money(row.debt)}</td></tr>`; }
function projectionHeader() { return '<thead><tr><th>Month / milestone</th><th>Portfolio</th><th>Inflation-adjusted target</th><th>SIP / bonus / invested</th><th>Loan payment</th><th>L1 balance</th><th>L2 balance</th><th>L3 balance</th><th>Total debt</th></tr></thead>'; }
function yearFor(row) { const date = new Date(START_DATE); date.setMonth(date.getMonth() + row.month - 1); return date.getFullYear(); }
function buildProjection(schedule) { const years = new Map(); schedule.forEach(row => { const year = yearFor(row); years.set(year, [...(years.get(year) || []), row]); }); const body = [...years.entries()].map(([year, months]) => { const end = months.at(-1), key = `year-${year}`; const sipTotal = months.reduce((sum, row) => sum + row.sip, 0), bonusTotal = months.reduce((sum, row) => sum + row.bonus, 0), investedTotal = months.reduce((sum, row) => sum + row.invested, 0), paymentTotal = months.reduce((sum, row) => sum + row.loanPayment, 0); const loanMap = Object.fromEntries(end.loans.map(loan => [loan.id, loan.balance])); const summary = `<tr class="year-summary-row"><td><button class="year-toggle" data-year="${key}" aria-expanded="false"><span>+</span></button><strong>${year}</strong><small>through ${end.date}</small></td><td>${money(end.portfolio)}</td><td>${money(end.target)}</td><td>${money(sipTotal)} / ${money(bonusTotal)} / ${money(investedTotal)}</td><td>${money(paymentTotal)}</td><td>${money(loanMap.L1)}</td><td>${money(loanMap.L2)}</td><td>${money(loanMap.L3)}</td><td>${money(end.debt)}</td></tr>`; const details = months.map(row => projectionCells(row, `month-detail ${key}`, true)).join(''); return summary + details; }).join(''); return `<div class="projection-table-wrap"><table class="projection-table">${projectionHeader()}<tbody>${body}</tbody></table></div>`; }
function milestoneText(snapshot) { return snapshot ? `${snapshot.date}: portfolio ${money(snapshot.portfolio)} vs. target ${money(snapshot.target)}; loans ${snapshot.loans.map(loan => `${loan.id} ${money(loan.balance)}`).join(', ')}` : '—'; }
function renderStrategy(result, prefix) {
  const complete = result.finishSnapshot;
  $(`#${prefix}Result`).textContent = complete ? complete.date : 'Not reached';
  $(`#${prefix}Sub`).textContent = complete ? `${money(complete.portfolio)} portfolio vs. ${money(complete.target)} inflation-adjusted target · ${duration(result.finish)}` : 'Increase cash flow or revise target';
  $(`#${prefix}Age`).textContent = complete ? `${ageAt(result.finish)} years` : '—';
}
function calculate() {
  const grow = simulate('grow'), clear = simulate('clear');
  projectionData = { invest: grow, debt: clear };
  renderStrategy(grow, 'invest'); renderStrategy(clear, 'debt');
  $('#investDebt').textContent = grow.finishSnapshot ? money(grow.finishSnapshot.debt) : '—';
  $('#debtFree').textContent = clear.debtFree ? duration(clear.debtFree) : '—';
  const finishMonths = [grow.finish, clear.finish].filter(Boolean); const earliest = finishMonths.length ? Math.min(...finishMonths) : null;
  $('#bestYear').textContent = earliest ? monthLabel(earliest) : 'Plan needed';
  $('#bestLabel').textContent = earliest ? `Earliest joint corpus + debt-free date · age ${ageAt(earliest)}` : 'Increase investment or adjust your target';
  $('#investMilestone').textContent = `Grow First — corpus hit: ${milestoneText(grow.milestones.corpusHit)}. Debt-free: ${milestoneText(grow.milestones.debtFree)}.`;
  $('#debtMilestone').textContent = `Clear First — debt-free: ${milestoneText(clear.milestones.debtFree)}. Corpus hit: ${milestoneText(clear.milestones.corpusHit)}.`;
  const gap = grow.finish && clear.finish ? Math.abs(grow.finish - clear.finish) : null;
  $('#finishGap').textContent = gap !== null ? `Finish-date gap: ${gap} months (${grow.finish < clear.finish ? 'Grow First earlier' : grow.finish > clear.finish ? 'Clear First earlier' : 'same month'}).` : '';
}
function savePlan() { const fields = ['currentAge', 'retireAge', 'inflation', 'corpus', 'monthlyExpense', 'sip', 'sipIncrease', 'annualBonus', 'bonusMonth']; const scalar = fields.reduce((out, id) => (out[id] = $(`#${id}`).value, out), {}); const serialize = (type, names) => rows(type).map(row => names.reduce((out, name) => (out[name] = row.querySelector(`.${name}`).value, out), {})); localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...scalar, investments: serialize('investment', ['name', 'amount', 'rate']), loans: serialize('loan', ['name', 'principal', 'rate', 'emi', 'tenure']) })); }
function refresh() { const investmentTotal = investments().reduce((sum, item) => sum + item.amount, 0), loanTotal = loans().reduce((sum, item) => sum + item.principal, 0), target = number($('#corpus')); $('#investmentTotal').textContent = money(investmentTotal); $('#loanTotal').textContent = money(loanTotal); $('#targetDisplay').textContent = money(target); $('#investedDisplay').textContent = money(investmentTotal); const progress = target ? Math.min(100, investmentTotal / target * 100) : 0; $('#progressFill').style.width = `${progress}%`; $('#progressText').textContent = progress ? `${progress.toFixed(1)}% of your today-value retirement target is already invested.` : 'Add investments to see your starting progress.'; $('#estimatedCorpus').textContent = money(number($('#monthlyExpense')) * 12 * 25); calculate(); savePlan(); }
function resetPlan() { $('#investmentRows').innerHTML = ''; $('#loanRows').innerHTML = ''; $('#currentAge').value = 32; $('#retireAge').value = 45; $('#inflation').value = 6; $('#corpus').value = 40000000; $('#sip').value = 110000; $('#sipIncrease').value = 10; $('#annualBonus').value = 0; $('#bonusMonth').value = 3; addRow('investment', { name: 'Emergency Fund (FD)', amount: 500000, rate: 6 }); addRow('investment', { name: 'Indian Stocks', amount: 1301000, rate: 12 }); addRow('investment', { name: 'Mutual Funds', amount: 4930000, rate: 12 }); addRow('investment', { name: 'Provident Fund (EPF)', amount: 1621000, rate: 8 }); addRow('investment', { name: 'US Stocks', amount: 1162000, rate: 12 }); addRow('investment', { name: 'GS US Stocks', amount: 586000, rate: 12 }); addRow('loan', { name: 'Bengaluru Flat', principal: 4625000, rate: 7.10, emi: 0, tenure: 126 }); addRow('loan', { name: 'Coimbatore Plot', principal: 3320000, rate: 7.65, emi: 0, tenure: 166 }); addRow('loan', { name: 'Bengaluru Investment Plot', principal: 6370000, rate: 7.45, emi: 0, tenure: 212 }); refresh(); }
function loadPlan() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (!saved) return false; ['currentAge', 'retireAge', 'inflation', 'corpus', 'monthlyExpense', 'sip', 'sipIncrease', 'annualBonus', 'bonusMonth'].forEach(id => { if (saved[id] !== undefined) $(`#${id}`).value = saved[id]; }); $('#investmentRows').innerHTML = ''; $('#loanRows').innerHTML = ''; saved.investments?.forEach(row => addRow('investment', row)); saved.loans?.forEach(row => addRow('loan', row)); return true; } catch { return false; } }
function showStep(step) { document.querySelectorAll('[data-step-panel]').forEach(panel => { panel.hidden = panel.dataset.stepPanel !== step; }); document.querySelectorAll('[data-step-target]').forEach(control => control.classList.toggle('active', control.dataset.stepTarget === step)); if (step === 'compare') refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function openProjection(path) { const result = projectionData[path]; if (!result) return; $('#projectionModalTitle').textContent = path === 'invest' ? 'Grow First — yearly projection' : 'Clear First — yearly projection'; $('#projectionModalContent').innerHTML = buildProjection(result.schedule); $('#projectionModal').showModal(); }
document.querySelectorAll('[data-open-projection]').forEach(button => button.addEventListener('click', () => openProjection(button.dataset.openProjection)));
$('#closeProjection').onclick = () => $('#projectionModal').close();
$('#projectionModal').addEventListener('click', event => { if (event.target === $('#projectionModal')) $('#projectionModal').close(); });
$('#projectionModalContent').addEventListener('click', event => { const toggle = event.target.closest('.year-toggle'); if (!toggle) return; const open = toggle.getAttribute('aria-expanded') === 'true'; toggle.setAttribute('aria-expanded', String(!open)); toggle.querySelector('span').textContent = open ? '+' : '−'; $('#projectionModalContent').querySelectorAll(`.month-detail.${toggle.dataset.year}`).forEach(row => { row.hidden = open; }); });
document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => { addRow(button.dataset.add); refresh(); }); ['currentAge', 'retireAge', 'inflation', 'corpus', 'monthlyExpense', 'sip', 'sipIncrease', 'annualBonus', 'bonusMonth'].forEach(id => $(`#${id}`).addEventListener('input', refresh)); $('#useEstimate').onclick = () => { $('#corpus').value = number($('#monthlyExpense')) * 12 * 25; refresh(); }; $('#calculateBtn').onclick = calculate; $('#resetBtn').onclick = resetPlan; document.querySelectorAll('[data-step-target]').forEach(control => control.addEventListener('click', event => { event.preventDefault(); showStep(control.dataset.stepTarget); })); document.querySelectorAll('[data-next]').forEach(control => control.addEventListener('click', () => showStep(control.dataset.next))); if (!loadPlan()) resetPlan(); else refresh(); showStep('goals');
