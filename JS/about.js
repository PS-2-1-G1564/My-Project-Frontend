/* =====================================
   CRYSTALVOLT - SELECTED MATERIAL PROPERTIES
===================================== */

const API_BASE_URL = "https://crystalvlt-api.onrender.com/https://crystalvlt-api.onrender.com/";

const statusElement = document.getElementById("properties-status");
const propertiesContainer = document.getElementById("material-properties");

const ALLOWED_SECTIONS = [
    "material overview",
    "chemical composition",
    "crystal structure",
    "physical properties",
    "electronic properties",
    "atomic structure",
    "stability"
];

async function loadMaterialProperties() {
    if (!statusElement || !propertiesContainer) {
        console.error("Material properties HTML elements were not found.");
        return;
    }

    let materialData;

    try {
        materialData = JSON.parse(
            localStorage.getItem("crystalVoltMaterial") || "null"
        );
    } catch (error) {
        showError("Saved material information is invalid. Please perform a new prediction.");
        return;
    }

    if (!materialData || !materialData.materialId) {
        showError("Material information not found. Please perform a prediction first.");
        return;
    }

    const { materialId, electrodeFormula, workingMetal } = materialData;
    statusElement.innerHTML = `
        <div class="properties-loading">
            <span class="properties-loader"></span>
            Loading selected material properties...
        </div>
    `;

    try {
        const url =
    `${API_BASE_URL}/materials/${encodeURIComponent(materialId)}/properties`;

        const response = await fetch(url);
        const report = await response.json();

        if (!response.ok) {
            throw new Error(
                report.detail || "Unable to retrieve material properties."
            );
        }

        displayMaterialProperties(report);

        statusElement.textContent =
            `Properties retrieved for ${electrodeFormula || "selected material"} (${materialId}).`;

    } catch (error) {
        showError(error.message || "Unable to load material properties.");
        console.error("Material properties error:", error);
    }
}


function displayMaterialProperties(report) {
    propertiesContainer.replaceChildren();

    const sections = report.sections || {};

    const selectedSections = Object.entries(sections).filter(
        ([key, section]) => {
            const title = normalizeText(section?.title || key);
            return ALLOWED_SECTIONS.includes(title);
        }
    );

    if (selectedSections.length === 0) {
        showError("No selected material-property sections were returned by the API.");
        return;
    }

    // Separate Atomic Structure from the other properties.
    const normalSections = [];
    const atomicSections = [];

    selectedSections.forEach(([key, section]) => {
        const title = normalizeText(section?.title || key);

        if (title === "atomic structure") {
            atomicSections.push([key, section]);
        } else {
            normalSections.push([key, section]);
        }
    });

    // Helper to create and display each property section.
    function createPropertySection(sectionKey, section, isAtomic = false) {
        const card = document.createElement("section");

        card.className = isAtomic
            ? "property-section atomic-structure-full-width"
            : "property-section";

        const heading = document.createElement("h3");
        heading.textContent = section.title || formatLabel(sectionKey);
        card.appendChild(heading);

        if (
            typeof section.description === "string" &&
            section.description.trim()
        ) {
            const paragraph = document.createElement("p");
            paragraph.className = "property-description";
            paragraph.textContent = section.description;
            card.appendChild(paragraph);
        }

        const entries = Object.entries(section).filter(
            ([key, value]) =>
                key !== "title" &&
                key !== "description" &&
                value !== null &&
                value !== undefined &&
                value !== ""
        );

        entries.forEach(([key, value]) => {
            if (isDescriptionField(key) && typeof value === "string") {
                const paragraph = document.createElement("p");
                paragraph.className = "property-description";
                paragraph.textContent = value;
                card.appendChild(paragraph);
                return;
            }

            if (isObject(value)) {
                const subSection = document.createElement("div");
                subSection.className = "property-subsection";

                const subHeading = document.createElement("h4");
                subHeading.textContent = formatLabel(key);
                subSection.appendChild(subHeading);

                renderStructuredValue(subSection, value);
                card.appendChild(subSection);
                return;
            }

            appendPropertyRow(card, key, value);
        });

        return card;
    }

    // First display all normal material properties.
    normalSections.forEach(([key, section]) => {
        propertiesContainer.appendChild(
            createPropertySection(key, section)
        );
    });

    // Finally display the complete Atomic Structure section.
    atomicSections.forEach(([key, section]) => {
        propertiesContainer.appendChild(
            createPropertySection(key, section, true)
        );
    });
}


function renderStructuredValue(container, value) {
    if (Array.isArray(value)) {
        if (value.length === 0) return;

        if (value.every(item => !isObject(item) && !Array.isArray(item))) {
            appendPropertyTable(container, [
                ["Values", value.map(formatValue).join(", ")]
            ]);
            return;
        }

        value.forEach((item, index) => {
            const itemContainer = document.createElement("div");
            itemContainer.className = "property-nested-item";

            if (isObject(item)) {
                const itemHeading = document.createElement("h5");
                itemHeading.textContent = `Entry ${index + 1}`;
                itemContainer.appendChild(itemHeading);

                renderStructuredValue(itemContainer, item);
            } else {
                appendPropertyTable(itemContainer, [
                    ["Value", formatValue(item)]
                ]);
            }

            container.appendChild(itemContainer);
        });

        return;
    }

    const rows = Object.entries(value)
        .filter(([, itemValue]) =>
            itemValue !== null &&
            itemValue !== undefined &&
            itemValue !== ""
        )
        .map(([key, itemValue]) => [
            formatLabel(key),
            formatValue(itemValue)
        ]);

    if (rows.length) {
        appendPropertyTable(container, rows);
    }
}

function appendPropertyRow(container, key, value) {
    appendPropertyTable(
        container,
        [[formatLabel(key), formatValue(value)]],
        true
    );
}

function appendPropertyTable(container, rows, appendToExisting = false) {
    let table = appendToExisting
        ? container.querySelector(":scope > table.property-table")
        : null;

    if (!table) {
        table = document.createElement("table");
        table.className = "property-table";

        const tbody = document.createElement("tbody");
        table.appendChild(tbody);
        container.appendChild(table);
    }

    const tbody = table.querySelector("tbody");

    rows.forEach(([label, value]) => {
        const row = document.createElement("tr");

        const labelCell = document.createElement("th");
        labelCell.scope = "row";
        labelCell.textContent = label;

        const valueCell = document.createElement("td");
        valueCell.textContent = value;

        row.append(labelCell, valueCell);
        tbody.appendChild(row);
    });
}

function isObject(value) {
    return value !== null && typeof value === "object";
}

function isDescriptionField(key) {
    return normalizeText(key).includes("description");
}

function formatValue(value) {
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (Array.isArray(value)) {
        return value.map(formatValue).join(", ");
    }

    if (isObject(value)) {
        return Object.entries(value)
            .map(([key, item]) =>
                `${formatLabel(key)}: ${formatValue(item)}`
            )
            .join(" | ");
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return Number(value.toFixed(6)).toString();
    }

    return String(value);
}

function normalizeText(value) {
    return String(value)
        .replace(/^\d+[_\s-]*/, "")
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
        .toLowerCase();
}

function formatLabel(value) {
    return String(value)
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, character => character.toUpperCase());
}

function showError(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }

    if (propertiesContainer) {
        propertiesContainer.replaceChildren();
    }
}

loadMaterialProperties();