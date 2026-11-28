
// =====================================
// CRYSTALVOLT - MATERIAL INPUT
// =====================================

const resultsButton = document.querySelector(".results-button");

if (resultsButton) {
    resultsButton.addEventListener("click", function () {
    // Get user inputs
    const formula = document.getElementById("electrode-formula").value.trim();

    const metal = document.getElementById("metal-type").value;

    // Validate inputs
    if (formula === "") {
        alert("Please enter the electrode formula.");
        return;
    }

    if (metal === "") {
        alert("Please select the type of metal.");
        return;
    }


const firstElementMatch = formula.match(/^([A-Z][a-z]?)/);

if (!firstElementMatch || firstElementMatch[1] !== metal) {
    alert(
        `Mismatch! The selected working metal (${metal}) must match the first element (${firstElementMatch ? firstElementMatch[1] : "unknown"}) in the electrode formula.`
    );
    return;
}


    // Store material details
    const materialData = {
        electrodeFormula: formula,
        workingMetal: metal
    };

    localStorage.setItem(
        "crystalVoltMaterial",
        JSON.stringify(materialData)
    );

    // Navigate to prediction page
    window.location.href = "prediction.html";

});
}