# RetireRoute

<p align="center">
  <img src="assets/logo.png" alt="RetireRoute logo" width="120" />
  <br />
  <strong>Plan Today. Grow Tomorrow. Retire Free.</strong>
</p>

[![Deploy to GitHub Pages](https://github.com/KarthickVellingiri/RetireRoute/actions/workflows/pages.yml/badge.svg)](https://github.com/KarthickVellingiri/RetireRoute/actions/workflows/pages.yml)

**RetireRoute** is a private, browser-based retirement and debt-payoff planner for comparing two cash-flow strategies:

- **Grow First** — invest until the inflation-adjusted retirement corpus is reached, then redirect cash flow to debt.
- **Clear First** — clear loans first, then invest the SIP and recycled EMIs.

All calculations run locally in the browser. No financial details are sent to a server. The repository ships with anonymous demo values only.

## First-time setup

No package installation is required.

1. Open a terminal in this folder.
2. Start a simple local server:

   ```powershell
   python -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000) in a browser.
4. Follow the four steps in the UI: **Goals → Investments → Loans & SIP → Compare**.

You may also open `index.html` directly, though a local server is the most reliable option for browser storage and testing.

## How to use the planner

1. In **Goals**, set your current age, retirement target, corpus in today’s money, and inflation assumption.
2. In **Investments**, add every existing holding with its current value and expected annual return.
3. In **Loans & SIP**, enter outstanding balance, interest rate, and remaining tenure. The app derives the contractual EMI from those three inputs. Add your monthly SIP and its annual increase.
4. Optionally add a fixed **annual bonus / extra income** and select the month in which you normally receive it.
5. In **Compare**, open either year-by-year projection and expand a year with `+` to inspect the individual simulated months.

The plan is automatically saved in this browser on this device. **Reset demo** restores the supplied anonymous sample plan.

Use **Export input.json** to download your current inputs as a private JSON backup. Use **Import input.json** to restore that JSON on another browser or device. Use **Export full plan** to download a report containing the inputs plus both strategy outputs, yearly chart data, and monthly projection tables. Keep exported files private; they can contain your financial details.

## Calculation methodology

The app uses a single identical month-by-month engine for both paths:

1. Each asset bucket and loan receives monthly nominal interest (`annual rate ÷ 12`).
2. Contractual EMIs are paid on every active loan.
3. The monthly SIP grows by the configured annual step-up every 12 months.
4. SIP and bonus investment contributions are allocated pro-rata across the 12% risk-asset buckets. FD and EPF receive no new contribution.
5. The retirement target is compounded monthly using the inflation rate.

For **Clear First**, the stepped-up SIP, annual bonus, and EMIs freed by paid-off loans are redirected immediately to the highest-rate remaining loan (the debt avalanche method). Once debt-free, this combined cash flow is invested.

For **Grow First**, SIP and annual bonus are invested until the portfolio first reaches the inflation-adjusted target. Thereafter, SIP, bonus, and freed EMIs are redirected to the highest-rate loan until debt-free. The plan finishes only once it is both debt-free and at or above the inflation-adjusted target.

## Privacy and storage

- RetireRoute stores your current plan in this browser's `localStorage`.
- Your inputs are not uploaded anywhere by this static app.
- Exported `input.json` and full-plan JSON files are created locally and may contain sensitive financial data.
- Do not commit exported plan files or personal values to a public repository.

## Important notes

This is an illustrative planning tool, not financial advice. It does not model taxes, exit loads, changes in loan rates, prepayment charges, market volatility, or future changes in income and spending. Validate major decisions with a qualified financial professional.
