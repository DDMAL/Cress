import CressView from './CressView';
import { ModalWindowView } from './utils/ModalWindow';

const schemaResponse = fetch(__ASSET_PREFIX__ + 'assets/validation/mei-all.rng');
const templateResponse = fetch(__ASSET_PREFIX__ + 'assets/validation/mei_template.mei');
let worker: Worker, schema: string, meiTemplate: string, versionField: HTMLSpanElement, statusField: HTMLSpanElement;
let validationResults: string[][] = []; // Array to store validation results for each MEI string
let validationCount: number = 0; // Counter to track the number of validations done

/**
 * Update the UI with the validation results. Called when the WebWorker finishes validating.
 */
function updateStatusUI(message: { data: string[] }): void {
  const errors = message.data;
  validationResults.push(errors);
  validationCount--;

  if (validationCount === 0) { // All validations are complete
    let hasError = false;
    let log = '';
    
    validationResults.forEach(result => {
      if (result !== null) {
        hasError = true;
        result.forEach(line => {
          log += line + '\n';
        });
      }
    });

    if (hasError) {
      statusField.textContent = '';
      statusField.style.color = 'red';
      const status = document.createElement('div');
      status.textContent = 'INVALID';
      status.style.cursor = 'pointer';
      statusField.appendChild(status);
      status.addEventListener('click', statusOnClick.bind(this, log));
    } else {
      statusField.textContent = 'VALID';
      statusField.style.color = '#4bc14b';
      for (const child of statusField.children) {
        child.remove();
      }
    }

    // Clear validation results for the next validation
    validationResults = [];
  }
}

function statusOnClick(log: string) {
  this.modal.setModalWindowView(ModalWindowView.ERROR_LOG, log);
  this.modal.openModalWindow();
}

/**
 * Add the validation information to the display and create the WebWorker
 * for validation MEI.
 */
export async function init(cressView: CressView): Promise<void> {
  const fileStatusDiv = document.getElementById('file-status');
  if (fileStatusDiv !== null) {
    const meiStatus = document.getElementById('validation_status');
    meiStatus.textContent = 'unknown';
    statusField = meiStatus;
    worker = new Worker(__ASSET_PREFIX__ + 'workers/ValidationWorker.js');
    worker.onmessage = updateStatusUI.bind(cressView);
  }
}

/**
 * Send the contents of multiple MEI files to the WebWorker for validation.
 * @param {string[]} meiDataArray
 */
export async function sendForValidation(meiDataArray: string[]): Promise<void> {
  if (statusField === undefined) return;

  if (schema === undefined) {
    const response = await schemaResponse;
    schema = await response.text();
  }

  if (meiTemplate === undefined) {
    const meiTemplateResponse = await templateResponse;
    meiTemplate = await meiTemplateResponse.text();
  }
  
  statusField.textContent = 'checking...';
  statusField.style.color = 'gray';
  
  validationCount = meiDataArray.length; // Initialize validation counter

  meiDataArray.forEach(meiData => {
    const parser = new DOMParser();
    const meiDoc = parser.parseFromString(meiTemplate, 'text/xml');
    const mei = meiDoc.documentElement;

    const layer = mei.querySelector('layer');
    layer.innerHTML = meiData;
    const serializer = new XMLSerializer();
    const toBeValidated = serializer.serializeToString(meiDoc);

    worker.postMessage({
      mei: toBeValidated,
      schema: schema
    });
  });
}

/**
 * Update the message on a blank page when there is no MEI.
 */
export function blankPage(): void {
  if (statusField === undefined || versionField === undefined) {
    return;
  }
  
  for (const child of statusField.children) {
    child.remove();
  }
  statusField.textContent = 'No MEI';
  statusField.style.color = 'color:gray';
}
