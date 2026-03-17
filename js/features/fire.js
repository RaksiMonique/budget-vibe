let fireChart = null;

function initFIRE() {
  fireForm.addEventListener("submit", (e) => {
    e.preventDefault();
    calculateFIREProjection();
  });
}

function renderFIRE() {
  if (!fireForm) return;
  
  // Default to state or reasonable defaults
  const s = state.fire || {};
  fireCurrentAge.value = s.currentAge ?? 30;
  // Default portfolio to current stock value if not set in state
  fireCurrentPortfolio.value = s.currentPortfolio ?? computeTotalStockValue();
  fireAnnualInvestment.value = s.annualInvestment ?? 12000;
  fireAnnualSpending.value = s.annualSpending ?? 50000;
  fireAnnualReturn.value = s.annualReturn ?? 7;
  fireWithdrawalRate.value = s.withdrawalRate ?? 4;
}

function calculateFIREProjection() {
  const currentAge = safeNumber(fireCurrentAge.value);
  const currentPortfolio = safeNumber(fireCurrentPortfolio.value);
  const annualInvestment = safeNumber(fireAnnualInvestment.value);
  const annualSpending = safeNumber(fireAnnualSpending.value);
  const annualReturn = safeNumber(fireAnnualReturn.value);
  const withdrawalRate = safeNumber(fireWithdrawalRate.value);

  state.fire = {
    currentAge,
    currentPortfolio,
    annualInvestment,
    annualSpending,
    annualReturn,
    withdrawalRate
  };
  saveState();

  if (withdrawalRate <= 0 || annualSpending <= 0) {
    alert("Please check your spending and withdrawal rate inputs.");
    return;
  }

  const fireNumber = annualSpending / (withdrawalRate / 100);
  
  let portfolio = currentPortfolio;
  let years = 0;
  const maxYears = 80;
  const dataPoints = [{ x: currentAge, y: portfolio }];

  // Simulation
  while (portfolio < fireNumber && years < maxYears) {
    years++;
    // Add returns
    portfolio += portfolio * (annualReturn / 100);
    // Add investment
    portfolio += annualInvestment;
    
    dataPoints.push({ x: currentAge + years, y: portfolio });
  }

  const ageAtFire = currentAge + years;
  const reached = portfolio >= fireNumber;

  fireResultSummary.innerHTML = `
    <div class="col-md-4">
      <div class="metric-label">FIRE Number</div>
      <div class="fs-4 fw-bold">${formatMoney(fireNumber)}</div>
    </div>
    <div class="col-md-4">
      <div class="metric-label">Years to FIRE</div>
      <div class="fs-4 fw-bold">${reached ? years : "> " + maxYears}</div>
    </div>
    <div class="col-md-4">
      <div class="metric-label">Age at FIRE</div>
      <div class="fs-4 fw-bold">${reached ? ageAtFire : "—"}</div>
    </div>
  `;

  renderFIREChart(dataPoints, fireNumber);
}

function renderFIREChart(dataPoints, fireNumber) {
  const ctx = fireChartCanvas?.getContext("2d");
  if (!ctx) return;

  const labels = dataPoints.map(p => `Age ${p.x}`);
  const values = dataPoints.map(p => p.y);

  if (fireChart) {
    fireChart.destroy();
  }

  fireChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Portfolio Value",
          data: values,
          borderColor: "#69856D", // sage
          backgroundColor: "rgba(105, 133, 109, 0.2)",
          fill: true,
          tension: 0.1
        },
        {
          label: "FIRE Goal",
          data: Array(labels.length).fill(fireNumber),
          borderColor: "#C27250", // clay
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => formatMoney(v).replace(".00", "") }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.dataset.label + ": " + formatMoney(ctx.raw)
          }
        },
        legend: { position: "bottom" }
      }
    }
  });
}