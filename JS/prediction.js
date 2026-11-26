// =====================================
// CRYSTALVOLT - PREDICTION PAGE (corrected)
// =====================================

const API_BASE_URL = "https://crystalvlt-api.onrender.com/https://crystalvlt-api.onrender.com/";

// Safely read material details from the Materials Input page
function readStoredMaterial() {
    try {
        return JSON.parse(localStorage.getItem("crystalVoltMaterial") || "null");
    } catch (error) {
        console.error("Stored material data is corrupted:", error);
        return null;
    }
}

const materialData = readStoredMaterial();

// Display selected material
if (materialData) {
    const formulaElement = document.getElementById("display-formula");
    const metalElement = document.getElementById("display-metal");

    if (formulaElement) formulaElement.textContent = materialData.electrodeFormula;
    if (metalElement) metalElement.textContent = materialData.workingMetal;
}

// =====================================
// CHART HELPERS
// =====================================

// Chart.js throws "Canvas is already in use" if another chart still owns the
// canvas (several functions below share one canvas), so always clear it first.
function prepareCanvas(id) {
    const canvas = document.getElementById(id);

    if (!canvas || !window.Chart) return null;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    return canvas;
}

// =====================================
// BATTERY CELL ANIMATION
// =====================================

function updateBatteryVisualization(voltage, minVoltage, maxVoltage) {
    const cells = document.querySelectorAll(".battery-cell");

    if (
        !Number.isFinite(voltage) ||
        !Number.isFinite(minVoltage) ||
        !Number.isFinite(maxVoltage) ||
        maxVoltage <= minVoltage
    ) {
        return;
    }

    const percentage = Math.max(
        0,
        Math.min(100, ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100)
    );

    const activeCells = Math.round((percentage / 100) * cells.length);

    cells.forEach((cell, index) => {
        cell.classList.toggle("active", index < activeCells);
    });

    const caption = document.getElementById("battery-caption");

    if (caption) {
        caption.textContent = `${percentage.toFixed(0)}% visual voltage scale`;
    }
}

// =====================================
// MODEL COMPARISON - DELAYED REVEAL
// =====================================

function showModelComparison() {
    const comparisonSection = document.getElementById("model-comparison");

    if (!comparisonSection) return;

    setTimeout(() => {
        comparisonSection.classList.remove("hidden-section");
        comparisonSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 3000);
}

// =====================================
// SHAP SECTIONS - SCROLL REVEAL
// =====================================

const shapSections = document.querySelectorAll(".shap-section");

if ("IntersectionObserver" in window) {
    const shapObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.remove("hidden-section");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    shapSections.forEach((section) => shapObserver.observe(section));
}

// =====================================
// MODEL COMPARISON CHART
// =====================================

let modelComparisonChart = null;

function renderModelComparisonChart(modelNames, metrics) {
    const canvas = prepareCanvas("model-comparison-chart");

    if (!canvas) {
        console.error("Model comparison chart not available.");
        return;
    }

    if (!Array.isArray(modelNames) || !modelNames.length || !metrics) {
        console.error("Invalid evaluation metrics.");
        return;
    }

    // Keep only models that actually have metrics
    const names = modelNames.filter(name => metrics[name]);

    if (!names.length) {
        console.error("No model metrics available.");
        return;
    }

    modelComparisonChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: names,
            datasets: [
                {
                    label: "MAE",
                    data: names.map(name => metrics[name].MAE),
                    backgroundColor: "#48C6CF"
                },
                {
                    label: "RMSE",
                    data: names.map(name => metrics[name].RMSE),
                    backgroundColor: "#519BAA"
                },
                {
                    label: "R²",
                    data: names.map(name => metrics[name].R2),
                    backgroundColor: "#A7DCE5"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } }
            },
            scales: {
                x: {
                    ticks: { color: "#ffffff" },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#ffffff" },
                    title: {
                        display: true,
                        text: "Metric Value",
                        color: "#ffffff"
                    }
                }
            }
        }
    });
}

// =====================================
// SHAP GRAPH 1, 2 AND 3
// =====================================

// Declared ONCE (the original declared the last two again in Part 3,
// which is a SyntaxError and stopped the whole script from running).
let shapImportanceChart = null;
let shapSummaryChart = null;
let localShapImpactChart = null;
let shapImpactChart = null;

// Blue = low feature value, Pink = high feature value
const SHAP_NEUTRAL = "#48C6CF";

function shapGradientColor(value, min, max) {
    if (
        !Number.isFinite(value) ||
        !Number.isFinite(min) ||
        !Number.isFinite(max)
    ) {
        return SHAP_NEUTRAL;
    }

    const t = max === min
        ? 0.5
        : Math.max(0, Math.min(1, (value - min) / (max - min)));

    const low = [59, 130, 246];
    const high = [236, 72, 153];

    const rgb = low.map((channel, i) =>
        Math.round(channel + (high[i] - channel) * t)
    );

    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// ---------- GRAPH 1 - FEATURE IMPORTANCE ----------

function renderShapImportanceChart(
    featureNames,
    shapValues,
    chartLabel = "Mean Absolute SHAP Value"
) {
    const canvas = prepareCanvas("shap-importance-chart");

    if (!canvas) {
        console.error("SHAP importance chart unavailable.");
        return;
    }

    if (
        !Array.isArray(featureNames) ||
        !Array.isArray(shapValues) ||
        featureNames.length !== shapValues.length ||
        !featureNames.length
    ) {
        console.error("Invalid SHAP importance data.");
        return;
    }

    const rows = featureNames
        .map((feature, i) => ({
            feature: String(feature),
            value: Math.abs(Number(shapValues[i]))
        }))
        .filter(row => Number.isFinite(row.value));

    rows.sort((a, b) => b.value - a.value);

    if (!rows.length) return;

    // Top feature = pink, lowest = blue
    shapImportanceChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: rows.map(row => row.feature),
            datasets: [{
                label: chartLabel,
                data: rows.map(row => row.value),
                backgroundColor: rows.map((_, i) =>
                    shapGradientColor(rows.length - 1 - i, 0, rows.length - 1)
                ),
                borderRadius: 7,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#ffffff" },
                    title: {
                        display: true,
                        text: chartLabel,
                        color: "#ffffff"
                    }
                },
                y: {
                    ticks: { color: "#ffffff" },
                    grid: { display: false }
                }
            }
        }
    });
}

// ---------- GRAPH 2 - SUMMARY (BEESWARM-STYLE) ----------

function renderShapSummaryChart(featureNames, shapPoints) {
    const canvas = prepareCanvas("shap-summary-chart");

    if (!canvas) {
        console.error("SHAP summary chart unavailable.");
        return;
    }

    if (
        !Array.isArray(featureNames) ||
        !Array.isArray(shapPoints) ||
        !featureNames.length ||
        !shapPoints.length
    ) {
        console.error("Invalid SHAP summary data.");
        return;
    }

    const featureIndexes = Object.fromEntries(
        featureNames.map((name, index) => [name, index])
    );

    // Feature-value ranges for gradient colours
    const ranges = {};

    shapPoints.forEach(point => {
        const value = Number(point.featureValue);

        if (
            point.featureValue !== null &&
            point.featureValue !== "" &&
            Number.isFinite(value)
        ) {
            if (!ranges[point.feature]) {
                ranges[point.feature] = { min: value, max: value };
            }

            ranges[point.feature].min = Math.min(ranges[point.feature].min, value);
            ranges[point.feature].max = Math.max(ranges[point.feature].max, value);
        }
    });

    const points = shapPoints
        .filter(point =>
            featureIndexes[point.feature] !== undefined &&
            Number.isFinite(Number(point.shapValue))
        )
        .map(point => ({
            x: Number(point.shapValue),
            y: featureIndexes[point.feature],
            feature: point.feature,
            featureValue: point.featureValue
        }));

    if (!points.length) {
        console.error("No valid SHAP points found.");
        return;
    }

    shapSummaryChart = new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [{
                label: "SHAP Values",
                data: points,
                backgroundColor: context => {
                    const point = context.raw;

                    if (!point) return SHAP_NEUTRAL;

                    const value = Number(point.featureValue);
                    const range = ranges[point.feature];

                    if (
                        !range ||
                        point.featureValue === null ||
                        point.featureValue === "" ||
                        !Number.isFinite(value)
                    ) {
                        return SHAP_NEUTRAL;
                    }

                    return shapGradientColor(value, range.min, range.max);
                },
                borderColor: "rgba(255,255,255,0.25)",
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const point = context.raw;
                            return (
                                `${point.feature}: ` +
                                `SHAP ${point.x.toFixed(4)}, ` +
                                `Feature value ${point.featureValue}`
                            );
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "SHAP Value",
                        color: "#ffffff"
                    },
                    ticks: { color: "#ffffff" }
                },
                y: {
                    // Integer bounds so every tick lands on a feature index.
                    // (The original used -0.5 / n-0.5 with stepSize 1, so ticks
                    // fell on half-values and feature labels never appeared.)
                    min: -1,
                    max: featureNames.length,
                    reverse: true,
                    ticks: {
                        stepSize: 1,
                        color: "#ffffff",
                        callback: value =>
                            Number.isInteger(value) ? (featureNames[value] || "") : ""
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// =====================================
// PART 3 - LOCAL SHAP IMPACT + DEPENDENCE
// =====================================

// Local explanation for the selected material.
function renderLocalShapImpactChart(topFeatures) {
    const canvas = prepareCanvas("shap-impact-chart");

    if (!canvas || !Array.isArray(topFeatures) || !topFeatures.length) {
        console.error("Local SHAP impact chart data unavailable.");
        return;
    }

    const rows = topFeatures
        .map(item => ({
            feature: item.property_name || item.feature,
            value: Number(item.shap_value),
            inputValue: item.feature_value ??
                        item.transformed_feature_value ??
                        null
        }))
        .filter(item => item.feature && Number.isFinite(item.value));

    if (!rows.length) return;

    localShapImpactChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: rows.map(item => item.feature),
            datasets: [{
                label: "Local SHAP contribution",
                data: rows.map(item => item.value),
                backgroundColor: rows.map(item =>
                    item.value >= 0 ? "#ed83b8" : "#48a9dc"
                ),
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const item = rows[context.dataIndex];
                            const lines = [
                                `SHAP contribution: ${item.value.toFixed(5)}`
                            ];

                            if (
                                item.inputValue !== null &&
                                Number.isFinite(Number(item.inputValue))
                            ) {
                                lines.push(`Feature value: ${item.inputValue}`);
                            }

                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "SHAP contribution",
                        color: "#ffffff"
                    },
                    ticks: { color: "#ffffff" },
                    grid: { color: "rgba(255,255,255,0.10)" }
                },
                y: {
                    ticks: { color: "#ffffff" },
                    grid: { display: false }
                }
            }
        }
    });
}

// Dataset-level dependence plot.
function renderShapImpactChart(featureValues, shapValues, featureName) {
    const canvas = prepareCanvas("shap-impact-chart");

    if (!canvas) {
        console.error("SHAP impact chart canvas or Chart.js not found.");
        return;
    }

    if (
        !Array.isArray(featureValues) ||
        !Array.isArray(shapValues) ||
        featureValues.length !== shapValues.length ||
        featureValues.length === 0
    ) {
        console.error("Invalid SHAP dependence data.");
        return;
    }

    const points = featureValues
        .map((value, index) => ({
            x: Number(value),
            y: Number(shapValues[index])
        }))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (!points.length) {
        console.error("No valid dependence points.");
        return;
    }

    // Avoid spreading huge arrays into Math.min/max
    let minValue = Infinity;
    let maxValue = -Infinity;

    points.forEach(point => {
        if (point.x < minValue) minValue = point.x;
        if (point.x > maxValue) maxValue = point.x;
    });

    shapImpactChart = new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [{
                label: `${featureName} dependence`,
                data: points,
                pointRadius: 5,
                pointHoverRadius: 7,
                // Original called shapGradientColor(ratio) with one argument,
                // so min/max were undefined and every point was neutral teal.
                backgroundColor: context => {
                    const value = context.raw?.x;
                    return shapGradientColor(value, minValue, maxValue);
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#ffffff" } },
                tooltip: {
                    callbacks: {
                        label: context => [
                            `${featureName}: ${context.raw.x}`,
                            `SHAP value: ${context.raw.y.toFixed(5)}`
                        ]
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    title: {
                        display: true,
                        text: `${featureName} value`,
                        color: "#ffffff"
                    },
                    ticks: { color: "#ffffff" },
                    grid: { color: "rgba(255,255,255,0.10)" }
                },
                y: {
                    title: {
                        display: true,
                        text: "SHAP value",
                        color: "#ffffff"
                    },
                    ticks: { color: "#ffffff" },
                    grid: { color: "rgba(255,255,255,0.10)" }
                }
            }
        }
    });
}

// =====================================
// API REQUEST HELPER
// =====================================

async function fetchUnseenJSON(url) {
    let response;

    try {
        response = await fetch(url);
    } catch (error) {
        throw new Error(
            "Cannot connect to the backend. Check that FastAPI is running."
        );
    }

    const responseText = await response.text();

    let data;

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error(
            `Backend returned an invalid response (HTTP ${response.status}).`
        );
    }

    if (!response.ok) {
        let message = data.detail || data.message;

        if (Array.isArray(message)) {
            message = message
                .map(item => item.msg || JSON.stringify(item))
                .join("; ");
        }

        throw new Error(message || `Backend error: HTTP ${response.status}`);
    }

    return data;
}

// =====================================
// PART 4 - KNOWN MATERIAL VOLTAGE PREDICTION
// =====================================

async function loadVoltagePrediction() {
    const voltageElement = document.getElementById("voltage-value");
    const statusElement = document.getElementById("voltage-status");
    const unseenWorkflow = document.getElementById("cv-unseen-workflow");

    if (!voltageElement || !statusElement) {
        console.error("Voltage display elements not found.");
        return;
    }

    if (!materialData) {
        statusElement.textContent = "Please select a material first.";
        return;
    }

    const formula = materialData.electrodeFormula;
    const workingIon = materialData.workingMetal;

    if (!formula || !workingIon) {
        statusElement.textContent = "Electrode formula or working metal is missing.";
        return;
    }

    statusElement.textContent = "Checking the material dataset...";
    voltageElement.textContent = "--.--";

    if (unseenWorkflow) unseenWorkflow.hidden = true;

    try {
        const url = new URL(`${API_BASE_URL}/predict`);
        url.searchParams.set("formula", formula);
        url.searchParams.set("working_ion", workingIon);

        const data = await fetchUnseenJSON(url);

        const voltageCard = document.querySelector(".voltage-card");

        // Material not found: switch to unseen-material workflow.
        if (!Array.isArray(data.results) || data.results.length === 0) {
            if (voltageCard) voltageCard.classList.add("cv-unseen-mode");

            statusElement.textContent =
                "Material not found in the training dataset.";

            if (unseenWorkflow) {
                unseenWorkflow.hidden = false;

                const formulaInput = document.getElementById("cv-unseen-formula");
                if (formulaInput) formulaInput.value = formula;

                await searchUnseenHostStructures();
            }

            return;
        }

        // Known-material workflow.
        const selectedResult = data.results[0];

        if (voltageCard) voltageCard.classList.remove("cv-unseen-mode");

        localStorage.setItem(
            "crystalVoltMaterial",
            JSON.stringify({
                ...materialData,
                materialId: selectedResult.material_id,
                predictionType: "known"
            })
        );

        const predictions = selectedResult.predictions || {};
        const voltage = Number(predictions.XGBoost);

        if (!Number.isFinite(voltage)) {
            throw new Error("Valid XGBoost prediction not received.");
        }

        voltageElement.textContent = voltage.toFixed(4);
        statusElement.textContent =
            "Known material voltage prediction completed successfully.";

        updateBatteryVisualization(voltage, 0, 5);

        await loadShapCharts(selectedResult.material_id, workingIon);
        await loadModelEvaluation();

        console.log("Known material prediction:", data);

    } catch (error) {
        console.error("Voltage prediction error:", error);
        voltageElement.textContent = "--.--";
        statusElement.textContent = error.message;
    }
}

// =====================================
// MODEL EVALUATION
// =====================================

async function loadModelEvaluation() {
    try {
        const data = await fetchUnseenJSON(
            new URL(`${API_BASE_URL}/model/evaluation`)
        );

        const metrics = data.models;

        if (!metrics || typeof metrics !== "object") {
            throw new Error("Model evaluation data is missing.");
        }

        renderModelComparisonChart(Object.keys(metrics), metrics);

        const section = document.getElementById("model-comparison");
        if (section) section.classList.remove("hidden-section");

        console.log("Model evaluation:", data);

    } catch (error) {
        console.error("Model evaluation error:", error);
    }
}

// =====================================
// UNSEEN MODEL EVALUATION
// =====================================

async function loadUnseenModelEvaluation() {
    const metrics = {
        "Random Forest": { MAE: 0.631615, RMSE: 1.035848, R2: 0.671887 },
        "XGBoost":       { MAE: 0.651686, RMSE: 1.024650, R2: 0.678943 },
        "KRR":           { MAE: 0.772859, RMSE: 1.132934, R2: 0.607499 },
        "SVR":           { MAE: 0.675481, RMSE: 1.096918, R2: 0.632058 },
        "DNN":           { MAE: 0.817874, RMSE: 1.169584, R2: 0.581694 }
    };

    const heading = document.querySelector("#model-comparison h2");
    const description = document.querySelector(
        "#model-comparison .comparison-description"
    );

    if (heading) {
        heading.textContent = "15-Feature Machine Learning Model Comparison";
    }

    if (description) {
        description.textContent =
            "Performance evaluation of five models trained using the 15-feature unseen-material dataset.";
    }

    renderModelComparisonChart(Object.keys(metrics), metrics);

    const section = document.getElementById("model-comparison");
    if (section) section.classList.remove("hidden-section");
}

// =====================================
// PART 5 - SHAP BACKEND INTEGRATION
// =====================================

// UNSEEN MATERIAL SHAP - THREE GRAPHS

// =====================================
// UNSEEN MATERIAL SHAP - LOCAL ANALYSIS
// Uses the selected material's own SHAP values
// =====================================

async function loadUnseenShapCharts(formula, materialId) {
    try {
        console.log("Loading LOCAL unseen material SHAP graphs...");

        const url = new URL(`${API_BASE_URL}/explain-unseen`);
        url.searchParams.set("formula", formula);
        url.searchParams.set("material_id", materialId);

        const data = await fetchUnseenJSON(url);

        // Use LOCAL SHAP data for the selected material
        const localData = data.local;

        if (!localData) {
            throw new Error("Local SHAP data is missing.");
        }

        if (
            !Array.isArray(localData.top_features) ||
            localData.top_features.length === 0
        ) {
            throw new Error("Local SHAP features are missing.");
        }

        const topFeatures = localData.top_features;

        const featureNames = topFeatures.map(
            item => item.property_name || item.feature
        );

        const shapValues = topFeatures.map(
            item => Number(item.shap_value)
        );

        // =====================================
        // GRAPH 1: LOCAL FEATURE IMPORTANCE
        // Absolute SHAP contribution of this material
        // =====================================

        renderShapImportanceChart(
            featureNames,
            shapValues,
            "Absolute Local SHAP Contribution"
        );

        // =====================================
        // GRAPH 2: LOCAL SHAP SUMMARY
        // One SHAP point for each feature of this material
        // =====================================

        const summaryPoints = topFeatures.map(item => ({
            feature: item.property_name || item.feature,
            shapValue: Number(item.shap_value),
            featureValue: item.feature_value
        }));

        renderShapSummaryChart(
            featureNames,
            summaryPoints
        );

        // =====================================
        // GRAPH 3: LOCAL FEATURE CONTRIBUTIONS
        // Positive = increases prediction
        // Negative = decreases prediction
        // =====================================

        renderLocalShapImpactChart(topFeatures);

        // Show SHAP sections
        document.querySelectorAll(".shap-section").forEach(section => {
            section.classList.remove("hidden-section");
        });

        console.log(
            "LOCAL unseen SHAP graphs rendered for:",
            formula,
            materialId
        );

        console.log("Local SHAP values:", topFeatures);

    } catch (error) {
        console.error("UNSEEN LOCAL SHAP ERROR:", error);
    }
}
// KNOWN MATERIAL - LOCAL SHAP
async function loadShapCharts(materialId, workingIon) {
    try {
        console.log("Requesting local SHAP:", materialId, workingIon);

        const url = new URL(
            `${API_BASE_URL}/explain/${encodeURIComponent(materialId)}`
        );
        url.searchParams.set("working_ion", workingIon || "Li");

        const data = await fetchUnseenJSON(url);

        if (!Array.isArray(data.top_features) || data.top_features.length === 0) {
            throw new Error("No local SHAP features returned.");
        }

        const topFeatures = data.top_features;

        const featureNames = topFeatures.map(
            item => item.property_name || item.feature
        );

        const shapValues = topFeatures.map(item => Number(item.shap_value));

        // Local importance: absolute SHAP magnitude
        renderShapImportanceChart(
            featureNames,
            shapValues.map(value => Math.abs(value))
        );

        // Local summary: one explanation point per feature
        const shapPoints = topFeatures.map(item => ({
            feature: item.property_name || item.feature,
            shapValue: Number(item.shap_value),
            featureValue: Number(
                item.feature_value ?? item.transformed_feature_value
            )
        }));

        renderShapSummaryChart(featureNames, shapPoints);

        // Local impact chart for the selected material
        renderLocalShapImpactChart(topFeatures);

        document.querySelectorAll(".shap-section").forEach(section => {
            section.classList.remove("hidden-section");
        });

        console.log("Known-material local SHAP charts rendered.");

    } catch (error) {
        console.error("Local SHAP error:", error);
    }
}

// =====================================
// PART 6 - UNSEEN MATERIAL WORKFLOW
// =====================================

let unseenHostStructures = [];
let unseenSelectedMaterialId = null;

let unseenFormula = materialData?.electrodeFormula || "";
let unseenWorkingIon = materialData?.workingMetal || "";

function initialiseUnseenMaterialWorkflow() {
    if (document.getElementById("cv-unseen-workflow")) return;

    const voltageCard = document.querySelector(".voltage-card");

    if (!voltageCard) {
        console.error("Voltage card not found.");
        return;
    }

    const workflow = document.createElement("section");

    workflow.id = "cv-unseen-workflow";
    workflow.className = "cv-unseen-workflow";
    workflow.hidden = true;

    workflow.innerHTML = `
        <div class="cv-unseen-heading">
            <h3>Material Not Found in Dataset</h3>
            <p>
                This electrode formula is not available in our training
                dataset. Find matching host structures from Materials
                Project to continue prediction.
            </p>
        </div>

        <div class="cv-unseen-form-row">
            <label for="cv-unseen-formula">Electrode Formula</label>
            <input
                id="cv-unseen-formula"
                type="text"
                autocomplete="off"
                placeholder="Enter electrode formula"
            >
            <button type="button" id="cv-find-structures">
                Find Host Structures
            </button>
        </div>

        <div class="cv-unseen-summary" id="cv-unseen-summary" hidden>
            <div>
                <span>Electrode Formula</span>
                <strong id="cv-summary-electrode">--</strong>
            </div>
            <div>
                <span>Working Ion</span>
                <strong id="cv-summary-ion">--</strong>
            </div>
            <div>
                <span>Host Composition</span>
                <strong id="cv-summary-host">--</strong>
            </div>
        </div>

        <div id="cv-structure-loading" class="cv-message" hidden>
            Searching Materials Project structures...
        </div>

        <div id="cv-structure-area" hidden>
            <h3>Available Crystal Structures</h3>
            <p class="cv-description">
                Select the host crystal structure you want to use
                for voltage prediction.
            </p>

            <div id="cv-structure-count"></div>

            <div class="cv-select-wrapper">
                <label for="cv-structure-select">
                    Select Material ID and Crystal Structure
                </label>
                <select id="cv-structure-select">
                    <option value="">Choose a structure</option>
                </select>
            </div>

            <div id="cv-selected-details"
                 class="cv-selected-details"
                 hidden></div>

            <button type="button" id="cv-predict-button" disabled>
                Predict Voltage
            </button>
        </div>

        <div id="cv-workflow-error" class="cv-error" hidden></div>

        <div id="cv-prediction-loading" class="cv-message" hidden>
            Generating voltage prediction...
        </div>

        <div id="cv-unseen-prediction-result" hidden>
            <div class="cv-unseen-voltage-result">
                <div class="card-label">PREDICTED VOLTAGE</div>
                <div class="voltage-value">
                    <span id="cv-unseen-voltage-value">--.--</span>
                    <span class="voltage-unit">V</span>
                </div>
                <p id="cv-unseen-voltage-status">
                    Select a host structure and predict its voltage.
                </p>
            </div>

            <div class="cv-unseen-summary">
                <div>
                    <span>Electrode Formula</span>
                    <strong id="cv-result-electrode">--</strong>
                </div>
                <div>
                    <span>Working Ion</span>
                    <strong id="cv-result-ion">--</strong>
                </div>
                <div>
                    <span>Crystal System</span>
                    <strong id="cv-result-crystal">--</strong>
                </div>
                <div>
                    <span>Prediction Model</span>
                    <strong id="cv-result-model">XGBoost</strong>
                </div>
            </div>
        </div>

        <div id="cv-result-details" class="cv-result-details" hidden></div>
        <div id="cv-result-warnings" class="cv-result-warnings"></div>
    `;

    voltageCard.appendChild(workflow);

    document.getElementById("cv-find-structures")
        .addEventListener("click", searchUnseenHostStructures);

    document.getElementById("cv-structure-select")
        .addEventListener("change", handleUnseenStructureSelection);

    document.getElementById("cv-predict-button")
        .addEventListener("click", predictUnseenMaterial);

    document.getElementById("cv-unseen-formula").value = unseenFormula;

    addUnseenWorkflowStyles();
}

// ---------- PARSE ELECTRODE FORMULA ----------

function parseFormulaForDisplay(formula) {
    const value = String(formula || "").trim();

    // Example: Li0.2-0.8FePO4
    const rangeMatch = value.match(
        /^([A-Z][a-z]?)(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(.+)$/
    );

    if (rangeMatch) {
        return {
            workingIon: rangeMatch[1],
            concentrationMin: Number(rangeMatch[2]),
            concentrationMax: Number(rangeMatch[3]),
            hostFormula: rangeMatch[4]
        };
    }

    // Example: Li0.2FePO4
    const fixedMatch = value.match(/^([A-Z][a-z]?)(\d+(?:\.\d+)?)(.+)$/);

    if (fixedMatch) {
        return {
            workingIon: fixedMatch[1],
            concentrationMin: Number(fixedMatch[2]),
            concentrationMax: Number(fixedMatch[2]),
            hostFormula: fixedMatch[3]
        };
    }

    // Example: LiFePO4
    const normalMatch = value.match(/^([A-Z][a-z]?)(.+)$/);

    if (normalMatch) {
        return {
            workingIon: normalMatch[1],
            concentrationMin: 1,
            concentrationMax: 1,
            hostFormula: normalMatch[2]
        };
    }

    throw new Error("Invalid electrode formula. Please check the formula.");
}

// ---------- SEARCH HOST STRUCTURES ----------

async function searchUnseenHostStructures() {
    const formulaInput = document.getElementById("cv-unseen-formula");
    const loading = document.getElementById("cv-structure-loading");
    const area = document.getElementById("cv-structure-area");

    if (!formulaInput || !loading || !area) return;

    const formula = formulaInput.value.trim();

    if (!formula) {
        showUnseenWorkflowError("Please enter an electrode formula.");
        return;
    }

    try {
        const parsed = parseFormulaForDisplay(formula);

        unseenFormula = formula;
        unseenWorkingIon = parsed.workingIon;

        localStorage.setItem(
            "crystalVoltMaterial",
            JSON.stringify({
                ...(readStoredMaterial() || {}),
                electrodeFormula: formula,
                workingMetal: parsed.workingIon
            })
        );

        displayUnseenFormulaSummary(formula, parsed.workingIon, parsed.hostFormula);

        hideUnseenWorkflowError();

        area.hidden = true;
        loading.hidden = false;
        loading.textContent = "Searching Materials Project structures...";

        const resultDetails = document.getElementById("cv-result-details");
        const resultWarnings = document.getElementById("cv-result-warnings");
        const predictionResult = document.getElementById("cv-unseen-prediction-result");

        if (resultDetails) resultDetails.hidden = true;
        if (resultWarnings) resultWarnings.textContent = "";
        if (predictionResult) predictionResult.hidden = true;

        document.getElementById("cv-predict-button").disabled = true;

        unseenSelectedMaterialId = null;
        unseenHostStructures = [];

        const url = new URL(`${API_BASE_URL}/materials/host-options`);
        url.searchParams.set("formula", formula);

        const data = await fetchUnseenJSON(url);

        unseenHostStructures = Array.isArray(data.structures)
            ? data.structures
            : [];

        if (!unseenHostStructures.length) {
            loading.textContent =
                "No matching host structures were found in Materials Project.";
            return;
        }

        renderUnseenStructureOptions(unseenHostStructures);

        loading.hidden = true;
        area.hidden = false;

    } catch (error) {
        console.error("Host structure search failed:", error);
        loading.hidden = true;
        showUnseenWorkflowError(error.message);
    }
}

function displayUnseenFormulaSummary(formula, workingIon, hostFormula) {
    const summary = document.getElementById("cv-unseen-summary");

    if (!summary) return;

    document.getElementById("cv-summary-electrode").textContent = formula;
    document.getElementById("cv-summary-ion").textContent = workingIon;
    document.getElementById("cv-summary-host").textContent = hostFormula;

    summary.hidden = false;
}

function renderUnseenStructureOptions(structures) {
    const select = document.getElementById("cv-structure-select");
    const count = document.getElementById("cv-structure-count");

    if (!select || !count) return;

    select.innerHTML = '<option value="">Choose a structure</option>';

    structures.forEach(structure => {
        const option = document.createElement("option");

        option.value = structure.material_id;
        option.textContent =
            `${structure.material_id} | ` +
            `${structure.formula_pretty || "Unknown formula"} | ` +
            `${structure.crystal_system || "Crystal system unavailable"}`;

        select.appendChild(option);
    });

    count.textContent = `${structures.length} matching structure(s) found.`;

    document.getElementById("cv-selected-details").hidden = true;
    document.getElementById("cv-predict-button").disabled = true;
}

function handleUnseenStructureSelection() {
    const select = document.getElementById("cv-structure-select");
    const details = document.getElementById("cv-selected-details");
    const predictButton = document.getElementById("cv-predict-button");

    unseenSelectedMaterialId = select.value || null;

    if (!unseenSelectedMaterialId) {
        details.hidden = true;
        predictButton.disabled = true;
        return;
    }

    const selected = unseenHostStructures.find(item =>
        String(item.material_id) === String(unseenSelectedMaterialId)
    );

    if (!selected) {
        details.hidden = true;
        predictButton.disabled = true;
        return;
    }

    details.innerHTML = `
        <h4>Selected Structure</h4>
        <div class="cv-detail-grid">
            ${unseenDetailItem("Material ID", selected.material_id)}
            ${unseenDetailItem("Formula", selected.formula_pretty)}
            ${unseenDetailItem("Crystal System", selected.crystal_system)}
            ${unseenDetailItem("Space Group Number", selected.space_group_number)}
            ${unseenDetailItem("Density", selected.density, "g/cm³")}
            ${unseenDetailItem("Energy Above Hull", selected.energy_above_hull, "eV/atom")}
        </div>
    `;

    details.hidden = false;
    predictButton.disabled = false;

    hideUnseenWorkflowError();
}

function unseenDetailItem(label, value, unit = "") {
    const displayValue =
        value === null || value === undefined || value === ""
            ? "Not available"
            : `${value}${unit ? " " + unit : ""}`;

    return `
        <div class="cv-detail-item">
            <span>${escapeUnseenHTML(label)}</span>
            <strong>${escapeUnseenHTML(displayValue)}</strong>
        </div>
    `;
}

// ---------- PREDICT SELECTED UNSEEN MATERIAL ----------

async function predictUnseenMaterial() {
    if (!unseenSelectedMaterialId) {
        showUnseenWorkflowError("Please select a crystal structure first.");
        return;
    }

    const button = document.getElementById("cv-predict-button");
    const loading = document.getElementById("cv-prediction-loading");
    const voltageElement = document.getElementById("voltage-value");
    const statusElement = document.getElementById("voltage-status");

    button.disabled = true;
    loading.hidden = false;
    hideUnseenWorkflowError();

    try {
        const url = new URL(`${API_BASE_URL}/predict-unseen`);

        url.searchParams.set("formula", unseenFormula);
        url.searchParams.set("material_id", unseenSelectedMaterialId);

        const data = await fetchUnseenJSON(url);

        const predictedVoltage = Number(data.predicted_voltage);

        if (!Number.isFinite(predictedVoltage)) {
            throw new Error("Backend did not return a valid predicted voltage.");
        }

        localStorage.setItem(
            "crystalVoltMaterial",
            JSON.stringify({
                ...(readStoredMaterial() || {}),
                electrodeFormula: data.electrode_formula || unseenFormula,
                workingMetal: data.working_ion || unseenWorkingIon,
                materialId: data.selected_material_id || unseenSelectedMaterialId,
                hostFormula: data.host_formula || "",
                predictionType: "unseen"
            })
        );

        if (voltageElement) voltageElement.textContent = predictedVoltage.toFixed(4);

        if (statusElement) {
            statusElement.textContent =
                "Unseen material voltage prediction completed successfully.";
        }

        displayUnseenPredictionResult(data);

        await loadUnseenModelEvaluation();
        await loadUnseenShapCharts(unseenFormula, unseenSelectedMaterialId);

    } catch (error) {
        console.error("Unseen prediction failed:", error);

        if (voltageElement) voltageElement.textContent = "--.--";
        if (statusElement) statusElement.textContent = error.message;

        showUnseenWorkflowError(error.message);

    } finally {
        loading.hidden = true;
        button.disabled = false;
    }
}

// =====================================
// PART 7 - RESULT DISPLAY + HELPERS
// =====================================

function displayUnseenPredictionResult(data) {
    const result = document.getElementById("cv-unseen-prediction-result");

    if (!result) {
        console.error("Unseen prediction result section not found.");
        return;
    }

    const voltage = Number(data.predicted_voltage);

    document.getElementById("cv-unseen-voltage-value").textContent =
        voltage.toFixed(4);

    document.getElementById("cv-unseen-voltage-status").textContent =
        "Unseen material voltage prediction completed.";

    document.getElementById("cv-result-electrode").textContent =
        data.electrode_formula || unseenFormula;

    document.getElementById("cv-result-ion").textContent =
        data.working_ion || unseenWorkingIon;

    const selected = unseenHostStructures.find(item =>
        String(item.material_id) === String(unseenSelectedMaterialId)
    );

    document.getElementById("cv-result-crystal").textContent =
        data.crystal_system || selected?.crystal_system || "Not available";

    document.getElementById("cv-result-model").textContent = "XGBoost";

    result.hidden = false;

    updateBatteryVisualization(voltage, 0, 5);

    const caption = document.getElementById("battery-caption");

    if (caption) {
        caption.textContent = `Predicted voltage: ${voltage.toFixed(4)} V`;
    }
}

function showUnseenWorkflowError(message) {
    const box = document.getElementById("cv-workflow-error");

    if (!box) return;

    box.textContent = message;
    box.hidden = false;
}

function hideUnseenWorkflowError() {
    const box = document.getElementById("cv-workflow-error");

    if (!box) return;

    box.textContent = "";
    box.hidden = true;
}

function escapeUnseenHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// =====================================
// UNSEEN WORKFLOW STYLES
// =====================================

function addUnseenWorkflowStyles() {
    if (document.getElementById("cv-unseen-workflow-styles")) return;

    const style = document.createElement("style");

    style.id = "cv-unseen-workflow-styles";

    style.textContent = `
        /* Classes below set display:grid/flex, which overrides the HTML
           "hidden" attribute. This rule makes hidden work everywhere. */
        .cv-unseen-workflow[hidden],
        .cv-unseen-workflow [hidden] {
            display: none !important;
        }

        .cv-unseen-workflow {
            background: rgba(15, 35, 60, 0.85);
            border: 1px solid rgba(72, 198, 207, 0.3);
            border-radius: 16px;
            padding: 24px;
            margin: 35px 0;
            color: #ffffff;
            backdrop-filter: blur(15px);
        }

        .cv-unseen-heading h3 {
            margin: 0 0 8px;
            color: #48C6CF;
        }

        .cv-unseen-heading p,
        .cv-description {
            color: #d0e5ed;
            font-size: 14px;
            line-height: 1.6;
        }

        .cv-unseen-form-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            margin: 20px 0;
        }

        .cv-unseen-form-row label {
            grid-column: 1 / -1;
            font-weight: 600;
            color: #ffffff;
        }

        .cv-unseen-form-row input {
            min-width: 0;
            padding: 13px;
            border: 1px solid rgba(72, 198, 207, 0.4);
            border-radius: 9px;
            background: #10243d;
            color: #ffffff;
            font-size: 14px;
        }

        .cv-unseen-form-row button,
        #cv-predict-button {
            border: none;
            border-radius: 9px;
            background: linear-gradient(100deg, #087bdb, #13bce9);
            color: #ffffff;
            padding: 13px 20px;
            font-weight: 600;
            cursor: pointer;
        }

        #cv-predict-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }

        .cv-unseen-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            background: rgba(72, 198, 207, 0.08);
            border-radius: 12px;
            padding: 18px;
            margin: 20px 0;
        }

        .cv-unseen-summary div {
            display: flex;
            flex-direction: column;
            gap: 7px;
            overflow-wrap: anywhere;
        }

        .cv-unseen-summary span,
        .cv-detail-item span {
            color: #b8dce5;
            font-size: 12px;
        }

        .cv-unseen-summary strong {
            color: #ffffff;
            font-size: 16px;
        }

        .cv-unseen-workflow h3 {
            color: #48C6CF;
            margin: 20px 0 8px;
        }

        .cv-select-wrapper {
            margin: 20px 0;
        }

        .cv-select-wrapper label {
            display: block;
            font-weight: 600;
            margin-bottom: 9px;
            color: #ffffff;
        }

        .cv-select-wrapper select {
            width: 100%;
            padding: 13px;
            border: 1px solid rgba(72, 198, 207, 0.4);
            border-radius: 9px;
            background: #10243d;
            color: #ffffff;
            font-size: 14px;
        }

        .cv-selected-details {
            background: rgba(72, 198, 207, 0.08);
            border-radius: 12px;
            padding: 18px;
            margin: 18px 0;
        }

        .cv-selected-details h4 {
            color: #48C6CF;
            margin: 0 0 14px;
        }

        .cv-detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin-top: 14px;
        }

        .cv-detail-item {
            background: rgba(2, 14, 27, 0.4);
            border: 1px solid rgba(72, 198, 207, 0.2);
            border-radius: 9px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 7px;
            overflow-wrap: anywhere;
        }

        .cv-detail-item strong {
            color: #ffffff;
            font-size: 14px;
        }

        .cv-message {
            color: #d0e5ed;
            padding: 14px;
            background: rgba(72, 198, 207, 0.08);
            border-radius: 9px;
            margin: 12px 0;
        }

        .cv-error {
            color: #ffb8b8;
            background: rgba(180, 40, 40, 0.15);
            border: 1px solid rgba(255, 100, 100, 0.3);
            border-radius: 9px;
            padding: 14px;
            margin: 14px 0;
        }

        .cv-result {
            margin-top: 26px;
            padding: 22px;
            background: rgba(72, 198, 207, 0.08);
            border: 1px solid rgba(72, 198, 207, 0.3);
            border-radius: 14px;
        }

        .cv-result h3,
        .cv-result h4 {
            color: #48C6CF;
            margin-top: 15px;
        }

        .cv-result-voltage {
            font-size: 38px;
            font-weight: 700;
            color: #ffffff;
            margin: 18px 0;
        }

        .cv-result-voltage small {
            font-size: 15px;
            font-weight: 400;
            color: #48C6CF;
        }

        #cv-result-warnings {
            margin-top: 18px;
            color: #f4d28b;
            font-size: 13px;
            line-height: 1.7;
        }

        #cv-result-features {
            margin-top: 20px;
        }

        @media (max-width: 600px) {
            .cv-unseen-workflow {
                padding: 16px;
            }

            .cv-unseen-form-row {
                grid-template-columns: 1fr;
            }

            .cv-unseen-form-row label {
                grid-column: 1;
            }

            .cv-result-voltage {
                font-size: 30px;
            }
        }
    `;

    document.head.appendChild(style);
}

// =====================================
// START CRYSTALVOLT PREDICTION
// =====================================

function startCrystalVoltPrediction() {
    console.log("CrystalVolt prediction initialized");

    initialiseUnseenMaterialWorkflow();
    loadVoltagePrediction();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCrystalVoltPrediction);
} else {
    startCrystalVoltPrediction();
}
