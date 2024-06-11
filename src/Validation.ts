import CressView from './CressView';
import { ModalWindowView } from './utils/ModalWindow';

let schemaPromise: Promise<string> | null = null;
let templatePromise: Promise<string> | null = null;

async function fetchSchemaAndTemplate(): Promise<void> {
    schemaPromise = fetch(
        __ASSET_PREFIX__ + 'assets/validation/mei-all.rng'
    ).then((response) => response.text());
    templatePromise = fetch(
        __ASSET_PREFIX__ + 'assets/validation/mei_template.mei'
    ).then((response) => response.text());
}

const worker = new Worker(__ASSET_PREFIX__ + 'workers/ValidationWorker.js');

function statusOnClick(log: string) {
    this.modal.setModalWindowView(ModalWindowView.ERROR_LOG, log);
    this.modal.openModalWindow();
}

/**
 * MEI validation based on custom cell validator in Handsontable
 * https://handsontable.com/docs/javascript-data-grid/cell-validator/#full-featured-example
 * @param {string} value
 */
export const meiValidator = async (
    value: string,
    callback: (result: boolean) => void
): Promise<void> => {
    if (schemaPromise === null || templatePromise === null) {
        await fetchSchemaAndTemplate();
    }

    try {
        let errors;
        const [schema, meiTemplate] = await Promise.all([
            schemaPromise!,
            templatePromise!,
        ]);
        errors = await validateMEI(value, schema, meiTemplate);
        if (errors == null) {
            callback(true);
        } else {
            callback(false);
        }
    } catch (e) {
        callback(false);
    }
};

function validateMEI(
    value: string,
    schema: string,
    meiTemplate: string
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

            const worker = new Worker(
                __ASSET_PREFIX__ + 'workers/ValidationWorker.js'
            );

            worker.postMessage({
                mei: toBeValidated,
                schema: schema,
            });

            worker.onmessage = (message: { data: string }) => {
                const errors = message.data;
                resolve(errors);
            };
        } catch (e) {
            resolve('Cannot read as XML');
        }
    });
}
