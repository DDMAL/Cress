import { validationStatus } from '../Types';

/**
 * Update the UI with the validation results. Called when the WebWorker finishes validating.
 */
export function updateStatus(
  status: validationStatus,
  hasInvalid?: boolean,
): void {
  const meiStatus: HTMLSpanElement =
    document.getElementById('validation_status')!;
  switch (status) {
    case 'processing':
      meiStatus.textContent = 'checking...';
      meiStatus.style.color = 'gray';
      break;

    case 'done':
      if (hasInvalid) {
        meiStatus.textContent = 'INVALID';
        meiStatus.style.color = 'red';
      } else {
        meiStatus.textContent = 'VALID';
        meiStatus.style.color = '#4bc14b';
      }
      break;

    default:
      meiStatus.textContent = 'unknown';
      meiStatus.style.color = 'gray';
      break;
  }
}

export class ValidationTools {
  private schemaPromise: Promise<string> | null = null;
  private templatePromise: Promise<string> | null = null;

  constructor() {
    this.fetchSchemaAndTemplate();
  }

  private async fetchSchemaAndTemplate(): Promise<void> {
    this.schemaPromise = fetch(
      __ASSET_PREFIX__ + 'assets/validation/mei-all.rng',
    ).then((response) => response.text());
    this.templatePromise = fetch(
      __ASSET_PREFIX__ + 'assets/validation/mei_template.mei',
    ).then((response) => response.text());
  }

  /**
   * MEI validation function
   */
  public meiValidator(value: string): Promise<[boolean, string[] | null]> {
    return new Promise(async (resolve) => {
      if (this.schemaPromise === null || this.templatePromise === null) {
        await this.fetchSchemaAndTemplate();
      }

      try {
        const schema = await this.schemaPromise;
        const meiTemplate = await this.templatePromise;

        const errors = await this.validateMEI(value, schema, meiTemplate);
        if (errors == null) {
          resolve([true, null]);
        } else {
          resolve([false, [errors]]);
        }
      } catch (e) {
        resolve([false, ['Failed to validate MEI']]);
      }
    });
  }

  private validateMEI(
    value: string,
    schema: string,
    meiTemplate: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      try {
        const parser = new DOMParser();
        const meiDoc = parser.parseFromString(meiTemplate, 'text/xml');
        const mei = meiDoc.documentElement;

        const layer = mei.querySelector('layer');
        layer.innerHTML = value;
        const serializer = new XMLSerializer();
        const toBeValidated = serializer.serializeToString(meiDoc);

        /**
         * TODO: optimize performance
         * use id to track each worker request
         */
        const worker = new Worker(
          __ASSET_PREFIX__ + 'workers/ValidationWorker.js',
        );

        worker.postMessage({
          mei: toBeValidated,
          schema: schema,
        });

        worker.onmessage = (message: { data: string }) => {
          const errors = message.data;
          resolve(errors);
          worker.terminate();
        };
      } catch (e) {
        resolve('Failed to validate MEI');
      }
    });
  }
}
