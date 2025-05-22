import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, FileUp, Loader2, AlertTriangle, Info, XCircle } from 'lucide-react';

// Tailwind CSS is assumed to be available globally.
// <script src="https://cdn.tailwindcss.com"></script> in your HTML.

// Helper function to safely get nested properties
const getDescendantProp = (obj, path) => {
  if (!path) return undefined;
  return path.split(/[.[\]]+/).filter(Boolean).reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return acc[part];
    }
    return undefined;
  }, obj);
};

const BENEFIT_CONFIG = [
  { id: "planName", label: "Plan Name", path: "pbp[0].planCharacteristics.planName", type: "direct" },
  { id: "contractId", label: "Contract ID", path: "pbp[0].contractId", type: "direct" },
  { id: "planId", label: "Plan ID", path: "pbp[0].planId", type: "direct" },
  {
    id: "annualDeductible",
    label: "Annual Deductible",
    type: "conditional",
    conditionPath: "pbp[0].planLevelCostSharing.lppoRppoDeductible.lppoRppoDeductibleDetails.annualPlnYesDed",
    conditionValue: "1",
    valuePath: "pbp[0].planLevelCostSharing.lppoRppoDeductible.lppoRppoDeductibleDetails.otherTypeDedAmount",
    defaultValue: "$0.00",
    prefix: "$"
  },
  { id: "inNetworkMOOP", label: "In-Network MOOP", path: "pbp[0].planLevelCostSharing.lppoRppoMaxEnrolleeCostLimit.lppoRppoMaxEnrolleeCostLimitDetails.meclInnMoopAmount", type: "direct", prefix: "$" },
  { id: "combinedMOOP", label: "Combined MOOP", path: "pbp[0].planLevelCostSharing.lppoRppoMaxEnrolleeCostLimit.lppoRppoMaxEnrolleeCostLimitDetails.meclCombMoopAmount", type: "direct", prefix: "$" },
  { id: "rxTier1Copay", label: "Rx Tier 1 Copay (Retail 1-Mo)", path: "pbp[0].rx.rxDetails.rxSetup.rxTiers.rxTier1.rxTier1PreIcl.preIclRetailOneMonthCopayment", type: "direct", prefix: "$" },
  { id: "rxTier2Copay", label: "Rx Tier 2 Copay (Retail 1-Mo)", path: "pbp[0].rx.rxDetails.rxSetup.rxTiers.rxTier2.rxTier2PreIcl.preIclRetailOneMonthCopayment", type: "direct", prefix: "$" },
  { id: "rxTier3Copay", label: "Rx Tier 3 Copay (Retail 1-Mo)", path: "pbp[0].rx.rxDetails.rxSetup.rxTiers.rxTier3.rxTier3PreIcl.preIclRetailOneMonthCopayment", type: "direct", prefix: "$" },
  {
    id: "pcpCopay",
    label: "Primary Care Physician Copay",
    type: "array_lookup",
    arrayPath: "pbp[0].benefitDetails.benefitDetailsInfo",
    lookupKey: "categoryCode",
    lookupValue: "7a", // Primary Care
    valuePath: "benefitDetails.CopaymentComponent.bdCopaymentAmount",
    defaultValue: "N/A",
    prefix: "$"
  },
  {
    id: "specialistCopay",
    label: "Specialist Copay",
    type: "array_lookup",
    arrayPath: "pbp[0].benefitDetails.benefitDetailsInfo",
    lookupKey: "categoryCode",
    lookupValue: "5", // Physician Specialist Services
    valuePath: "benefitDetails.CopaymentComponent.bdCopaymentAmount",
    defaultValue: "N/A",
    prefix: "$"
  },
   {
    id: "emergencyCareCopay",
    label: "Emergency Care Copay",
    type: "array_lookup",
    arrayPath: "pbp[0].benefitDetails.benefitDetailsInfo",
    lookupKey: "categoryCode",
    lookupValue: "4a",
    valuePath: "benefitDetails.CopayAdmWaivedTimelineComponent.CopayAdmWaivedTimelineComptCopayment.bdCopaymentAmount",
    defaultValue: "N/A",
    prefix: "$"
  },
  {
    id: "inpatientHospitalCopay",
    label: "Inpatient Hospital (Days 1-7)",
    type: "array_lookup",
    arrayPath: "pbp[0].benefitDetails.benefitDetailsInfo",
    lookupKey: "categoryCode",
    lookupValue: "1a",
    valuePath: "benefitDetails.TierCopaymentComponent.bdCopaymentTier1DayIntervalStay.bdDayInterval1CopaymentAmount",
    defaultValue: "N/A",
    prefix: "$"
  },
];

// Sample JSON data (replace with actual file loading)
const sampleJsonData1 = `{"contractYear":2025,"section":"MA&RX","pbp":[{"contractId":"H9572","planId":"006","segmentId":1,"planCharacteristics":{"planName":"Medicare Plus Blue PPO Part B Credit (PPO)"},"planLevelCostSharing":{"lppoRppoDeductible":{"lppoRppoDeductibleDetails":{"annualPlnYesDed":"1","otherTypeDedAmount":"600.00"}},"lppoRppoMaxEnrolleeCostLimit":{"lppoRppoMaxEnrolleeCostLimitDetails":{"meclInnMoopAmount":"6550.00","meclCombMoopAmount":"9000.00"}}},"rx":{"rxDetails":{"rxSetup":{"rxTiers":{"rxTier1":{"rxTier1PreIcl":{"preIclRetailOneMonthCopayment":"5.00"}},"rxTier2":{"rxTier2PreIcl":{"preIclRetailOneMonthCopayment":"20.00"}},"rxTier3":{"rxTier3PreIcl":{"preIclRetailOneMonthCopayment":"47.00"}}}}}},"benefitDetails":{"benefitDetailsInfo":[{"categoryTypeId":1,"categoryCode":"1a","benefitDetails":{"TierCopaymentComponent":{"bdCopaymentTier1DayIntervalStay":{"bdDayInterval1CopaymentAmount":"375.00"}}}},{"categoryTypeId":1,"categoryCode":"4a","benefitDetails":{"CopayAdmWaivedTimelineComponent":{"CopayAdmWaivedTimelineComptCopayment":{"bdCopaymentAmount":"110.00"}}}},{"categoryTypeId":1,"categoryCode":"5","benefitDetails":{"CopaymentComponent":{"bdCopaymentAmount":"55.00"}}},{"categoryTypeId":1,"categoryCode":"7a","benefitDetails":{"CopaymentComponent":{"bdCopaymentAmount":"0.00"}}}]}}]}`;
const sampleJsonData2 = `{"contractYear":2025,"section":"MA&RX","pbp":[{"contractId":"H9572","planId":"004","segmentId":1,"planCharacteristics":{"planName":"Medicare Plus Blue PPO Essential (PPO)"},"planLevelCostSharing":{"lppoRppoDeductible":{"lppoRppoDeductibleDetails":{"annualPlnYesDed":"2"}},"lppoRppoMaxEnrolleeCostLimit":{"lppoRppoMaxEnrolleeCostLimitDetails":{"meclInnMoopAmount":"6250.00","meclCombMoopAmount":"6250.00"}}},"rx":{"rxDetails":{"rxSetup":{"rxTiers":{"rxTier1":{"rxTier1PreIcl":{"preIclRetailOneMonthCopayment":"5.00"}},"rxTier2":{"rxTier2PreIcl":{"preIclRetailOneMonthCopayment":"20.00"}},"rxTier3":{"rxTier3PreIcl":{"preIclRetailOneMonthCopayment":"47.00"}}}}}},"benefitDetails":{"benefitDetailsInfo":[{"categoryTypeId":1,"categoryCode":"1a","benefitDetails":{"TierCopaymentComponent":{"bdCopaymentTier1DayIntervalStay":{"bdDayInterval1CopaymentAmount":"420.00"}}}},{"categoryTypeId":1,"categoryCode":"4a","benefitDetails":{"CopayAdmWaivedTimelineComponent":{"CopayAdmWaivedTimelineComptCopayment":{"bdCopaymentAmount":"125.00"}}}},{"categoryTypeId":1,"categoryCode":"5","benefitDetails":{"CopaymentComponent":{"bdCopaymentAmount":"45.00"}}},{"categoryTypeId":1,"categoryCode":"7a","benefitDetails":{"CopaymentComponent":{"bdCopaymentAmount":"0.00"}}}]}}]}`;


const App = () => {
  const [allPlansData, setAllPlansData] = useState([]);
  const [selectedPlanInternalIds, setSelectedPlanInternalIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const processPlanJson = useCallback((jsonData, fileName) => {
    try {
      const parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      const planIdentifier = `${getDescendantProp(parsedData, "pbp[0].contractId") || 'N/A'}_${getDescendantProp(parsedData, "pbp[0].planId") || 'N/A'}`;
      const internalId = `${planIdentifier}_${fileName}_${Date.now()}`; // Ensure uniqueness

      const extractedBenefits = {};
      BENEFIT_CONFIG.forEach(benefit => {
        let value;
        if (benefit.type === "direct") {
          value = getDescendantProp(parsedData, benefit.path);
        } else if (benefit.type === "conditional") {
          const conditionMet = getDescendantProp(parsedData, benefit.conditionPath) === benefit.conditionValue;
          value = conditionMet ? getDescendantProp(parsedData, benefit.valuePath) : benefit.defaultValue;
        } else if (benefit.type === "array_lookup") {
          const array = getDescendantProp(parsedData, benefit.arrayPath);
          if (Array.isArray(array)) {
            const item = array.find(i => getDescendantProp(i, benefit.lookupKey) === benefit.lookupValue);
            value = item ? getDescendantProp(item, benefit.valuePath) : benefit.defaultValue;
          } else {
            value = benefit.defaultValue;
          }
        }
        extractedBenefits[benefit.id] = value !== undefined && value !== null ? (benefit.prefix || '') + String(value) : (benefit.defaultValue || "N/A");
      });
      
      // Ensure core identifiers are present
      if (!extractedBenefits.planName || extractedBenefits.planName === "N/A") {
         extractedBenefits.planName = `Unnamed Plan (${fileName})`;
      }
      if (!extractedBenefits.contractId || extractedBenefits.contractId === "N/A") {
        extractedBenefits.contractId = "Unknown Contract";
      }
       if (!extractedBenefits.planId || extractedBenefits.planId === "N/A") {
        extractedBenefits.planId = "Unknown Plan";
      }

      return {
        internalId: internalId,
        fileName: fileName,
        ...extractedBenefits,
        originalData: parsedData, // Keep original data if needed later
      };
    } catch (e) {
      console.error(`Error processing plan ${fileName}:`, e);
      throw new Error(`Failed to parse or process ${fileName}. Ensure it's valid JSON and matches expected structure.`);
    }
  }, []);

  // Load initial sample data
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      const processedSample1 = processPlanJson(sampleJsonData1, "H9572-006-001-2025.json (Sample)");
      const processedSample2 = processPlanJson(sampleJsonData2, "H9572-004-001-2025.json (Sample)");
      setAllPlansData([processedSample1, processedSample2]);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [processPlanJson]);

  const handleFileUpload = async (event) => {
    setIsLoading(true);
    setError(null);
    setFileError(null);
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      setIsLoading(false);
      return;
    }

    const newPlans = [];
    let anyFileFailed = false;

    for (const file of files) {
      if (file.type !== 'application/json') {
        setFileError(`File ${file.name} is not a JSON file. Please upload only .json files.`);
        anyFileFailed = true;
        continue;
      }
      try {
        const fileContent = await file.text();
        const processedPlan = processPlanJson(fileContent, file.name);
        newPlans.push(processedPlan);
      } catch (e) {
        console.error(`Error processing file ${file.name}:`, e);
        setFileError(e.message || `An error occurred while processing ${file.name}.`);
        anyFileFailed = true;
      }
    }
    
    setAllPlansData(prevPlans => [...prevPlans, ...newPlans]);
    setIsLoading(false);
    if (anyFileFailed && newPlans.length === 0) {
      // Error already set by individual file processing
    } else if (anyFileFailed) {
      setFileError( (fileError ? fileError + " " : "") + "Some files were processed successfully, but others failed. Please check console for details.");
    }
     // Clear the file input so the same file can be uploaded again if needed
    event.target.value = null;
  };
  
  const comparisonData = useMemo(() => {
    return allPlansData.filter(plan => selectedPlanInternalIds.includes(plan.internalId));
  }, [allPlansData, selectedPlanInternalIds]);

  const handlePlanSelectionChange = (selectedIds) => {
    setSelectedPlanInternalIds(selectedIds);
  };

  const removePlan = (internalIdToRemove) => {
    setAllPlansData(prevPlans => prevPlans.filter(plan => plan.internalId !== internalIdToRemove));
    setSelectedPlanInternalIds(prevIds => prevIds.filter(id => id !== internalIdToRemove));
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
        <h3 className="font-bold">Application Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 font-sans p-4 sm:p-6 md:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400">
          Health Plan Benefit Comparator
        </h1>
        <p className="mt-2 text-slate-400 text-lg">
          Upload your plan JSON files and compare key benefits side-by-side.
        </p>
         <button 
            onClick={() => setShowInfoModal(true)}
            className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900"
          >
            <Info size={18} className="mr-2" />
            How to Use / Expected JSON Structure
          </button>
      </header>

      {showInfoModal && (
        <InfoModal onClose={() => setShowInfoModal(false)} />
      )}

      <div className="mb-8 p-6 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
        <label htmlFor="file-upload" className="block text-lg font-semibold mb-3 text-sky-300">
          Upload Plan JSON Files
        </label>
        <div className="flex items-center space-x-4">
          <input
            id="file-upload"
            type="file"
            multiple
            accept=".json"
            onChange={handleFileUpload}
            className="block w-full text-sm text-slate-300
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-sky-600 file:text-white
              hover:file:bg-sky-700
              file:transition-colors file:duration-150
              cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded-lg"
          />
          {isLoading && <Loader2 className="animate-spin text-sky-400" size={24} />}
        </div>
        {fileError && (
          <div className="mt-3 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm flex items-start">
            <AlertTriangle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
            <span>{fileError}</span>
          </div>
        )}
      </div>
      
      {allPlansData.length > 0 && (
        <div className="mb-8 p-6 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
          <PlanPicker
            plans={allPlansData}
            selectedPlanInternalIds={selectedPlanInternalIds}
            onSelectionChange={handlePlanSelectionChange}
          />
        </div>
      )}

      {isLoading && allPlansData.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="animate-spin text-sky-400" size={48} />
          <p className="ml-3 text-lg">Loading initial data...</p>
        </div>
      )}

      {comparisonData.length > 0 ? (
        <ComparisonTable plansToCompare={comparisonData} benefitConfig={BENEFIT_CONFIG} />
      ) : (
        allPlansData.length > 0 && !isLoading && (
          <div className="text-center p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
            <Info size={48} className="mx-auto mb-4 text-sky-500" />
            <p className="text-xl text-slate-300">Select plans from the dropdown above to compare their benefits.</p>
            <p className="text-sm text-slate-400 mt-2">You can select multiple plans to see them side-by-side.</p>
          </div>
        )
      )}

      {allPlansData.length > 0 && (
        <div className="mt-8 p-6 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
          <h3 className="text-lg font-semibold mb-3 text-sky-300">Uploaded Plans ({allPlansData.length})</h3>
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {allPlansData.map(plan => (
              <li key={plan.internalId} className="flex justify-between items-center p-2 bg-slate-700/50 rounded-md text-sm">
                <span className="truncate" title={`${plan.planName} (${plan.fileName})`}>{plan.planName} <span className="text-xs text-slate-400">({plan.fileName})</span></span>
                <button
                  onClick={() => removePlan(plan.internalId)}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                  title="Remove this plan"
                >
                  <XCircle size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {allPlansData.length === 0 && !isLoading && (
         <div className="text-center p-10 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
            <FileUp size={60} className="mx-auto mb-4 text-sky-500" />
            <p className="text-xl text-slate-300">No plans loaded yet.</p>
            <p className="text-md text-slate-400 mt-2">Please upload JSON plan files using the uploader above to get started.</p>
          </div>
      )}
    </div>
  );
};

const PlanPicker = ({ plans, selectedPlanInternalIds, onSelectionChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (planInternalId) => {
    const newSelectedIds = selectedPlanInternalIds.includes(planInternalId)
      ? selectedPlanInternalIds.filter(id => id !== planInternalId)
      : [...selectedPlanInternalIds, planInternalId];
    onSelectionChange(newSelectedIds);
  };

  const planOptions = plans.map(plan => ({
    value: plan.internalId,
    label: `${plan.planName || 'Unnamed Plan'} (Contract: ${plan.contractId || 'N/A'}, Plan: ${plan.planId || 'N/A'}) - ${plan.fileName}`
  }));
  
  const selectedCount = selectedPlanInternalIds.length;

  return (
    <div className="relative">
      <label className="block text-lg font-semibold mb-3 text-sky-300">Select Plans to Compare</label>
      <button
        type="button"
        className="w-full flex justify-between items-center px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="block truncate text-slate-200">
          {selectedCount > 0 ? `${selectedCount} plan(s) selected` : "Select plans..."}
        </span>
        <ChevronDown className={`ml-2 h-5 w-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-slate-700 shadow-lg rounded-lg border border-slate-600 max-h-72 overflow-y-auto custom-scrollbar">
          <ul className="py-1">
            {planOptions.map(option => (
              <li
                key={option.value}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-600 transition-colors ${selectedPlanInternalIds.includes(option.value) ? 'bg-sky-700 text-white' : 'text-slate-200'}`}
                onClick={() => handleToggle(option.value)}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPlanInternalIds.includes(option.value)}
                    readOnly
                    className="form-checkbox h-4 w-4 text-sky-500 bg-slate-600 border-slate-500 rounded focus:ring-sky-400 mr-3 cursor-pointer"
                  />
                  <span className="block truncate" title={option.label}>{option.label}</span>
                </div>
              </li>
            ))}
             {planOptions.length === 0 && (
                <li className="px-4 py-2.5 text-sm text-slate-400 text-center">No plans uploaded yet.</li>
             )}
          </ul>
        </div>
      )}
    </div>
  );
};

const ComparisonTable = ({ plansToCompare, benefitConfig }) => {
  if (!plansToCompare || plansToCompare.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flow-root">
        <h2 className="text-2xl font-semibold mb-4 text-sky-300">Benefit Comparison</h2>
      <div className="-my-2 overflow-x-auto">
        <div className="inline-block min-w-full py-2 align-middle">
          <div className="overflow-hidden shadow-xl ring-1 ring-slate-700 rounded-lg">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-slate-800/80 backdrop-blur-sm py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-sky-300 sm:pl-6 w-1/4 min-w-[200px]">
                    Benefit
                  </th>
                  {plansToCompare.map(plan => (
                    <th key={plan.internalId} scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-sky-300 min-w-[200px] truncate" title={plan.planName}>
                      {plan.planName}
                       <div className="text-xs font-normal text-slate-400">
                         {plan.contractId} - {plan.planId}
                       </div>
                       <div className="text-xs font-normal text-slate-500 truncate" title={plan.fileName}>
                         ({plan.fileName})
                       </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-800">
                {benefitConfig.map((benefit) => (
                  <tr key={benefit.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-slate-800/80 backdrop-blur-sm whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-200 sm:pl-6 w-1/4 min-w-[200px]">
                      {benefit.label}
                    </td>
                    {plansToCompare.map(plan => (
                      <td key={`${plan.internalId}-${benefit.id}`} className="whitespace-nowrap px-3 py-4 text-sm text-slate-300 min-w-[200px]">
                        {plan[benefit.id] !== undefined ? String(plan[benefit.id]) : 'N/A'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl max-w-2xl w-full border border-slate-700 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-sky-300">How to Use & Expected JSON Structure</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <XCircle size={24} />
          </button>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-slate-300 space-y-4">
          <p>
            This tool allows you to compare health plan benefits by uploading JSON files.
          </p>
          <h3 className="text-sky-400">How to Use:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click the "Browse" or "Choose Files" button under "Upload Plan JSON Files".</li>
            <li>Select one or more <code>.json</code> files from your computer. Each file should represent one health plan.</li>
            <li>The application will attempt to parse each file and extract key benefits.</li>
            <li>Once files are processed, they will appear in the "Uploaded Plans" list.</li>
            <li>Use the "Select Plans to Compare" dropdown to choose which of the uploaded plans you want to see in the comparison table. You can select multiple plans.</li>
            <li>The table below will update to show a side-by-side comparison of the selected plans for the predefined benefits.</li>
            <li>You can remove uploaded plans using the <XCircle size={14} className="inline -mt-0.5"/> button next to each plan in the "Uploaded Plans" list.</li>
          </ol>
          
          <h3 className="text-sky-400">Expected JSON Structure:</h3>
          <p>
            The application expects JSON files with a structure similar to the provided samples. Key data points are extracted based on predefined paths. For example:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Plan Name: <code>pbp[0].planCharacteristics.planName</code></li>
            <li>Annual Deductible: <code>pbp[0].planLevelCostSharing.lppoRppoDeductible.lppoRppoDeductibleDetails.otherTypeDedAmount</code> (if <code>annualPlnYesDed</code> is "1")</li>
            <li>In-Network MOOP: <code>pbp[0].planLevelCostSharing.lppoRppoMaxEnrolleeCostLimit.lppoRppoMaxEnrolleeCostLimitDetails.meclInnMoopAmount</code></li>
            <li>Rx Copays: e.g., <code>pbp[0].rx.rxDetails.rxSetup.rxTiers.rxTier1.rxTier1PreIcl.preIclRetailOneMonthCopayment</code></li>
            <li>Service Copays (e.g., PCP, Specialist): Found within <code>pbp[0].benefitDetails.benefitDetailsInfo</code> by looking up specific <code>categoryCode</code> values.</li>
          </ul>
          <p>
            If a JSON file is not structured as expected, or if certain data points are missing, "N/A" or a default value will be displayed for those benefits. The application will try to process files, but significant deviations from the expected structure might lead to errors or incomplete data extraction. Ensure your JSON files are valid and generally follow the schema of the sample data.
          </p>
          <p className="text-xs text-slate-500">
            The `BENEFIT_CONFIG` array in the application's code defines exactly which fields are extracted and how. This can be customized by a developer if different or additional benefits need to be tracked.
          </p>
        </div>
         <button
            onClick={onClose}
            className="mt-6 w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-sky-600 text-base font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 sm:text-sm"
          >
            Got it!
          </button>
      </div>
    </div>
  );
};


// Custom scrollbar style (add to your global CSS or a <style> tag in HTML)
// This is a suggestion, you might need to adjust for your specific setup.
const GlobalStyles = () => (
  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #334155; // slate-700
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #64748b; // slate-500
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8; // slate-400
    }
    .prose { /* Basic prose styling for modal */
      color: #d1d5db; /* gray-300 */
    }
    .prose h3 {
      color: #38bdf8; /* sky-400 */
      margin-bottom: 0.5em;
      margin-top: 1em;
    }
    .prose p, .prose li {
      font-size: 0.875rem; /* text-sm */
      line-height: 1.625;
    }
    .prose ol, .prose ul {
      padding-left: 1.5em;
    }
  `}</style>
);

// Main App component to be exported
export default function PlanComparisonHost() {
  return (
    <>
      <GlobalStyles />
      <App />
    </>
  );
}

