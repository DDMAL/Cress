import Handsontable from 'handsontable';
import { updateStatus, ValidationTools } from './ValidationTools';
import * as Notification from '../utils/Notification';
import { MeiData } from '../Types';

export class MeiTools {
  private meiData: MeiData;
  public validationInProgress = false;
  public pendingValidations = 0;
  private validationTools: ValidationTools;

  constructor() {
    this.validationTools = new ValidationTools();
    this.meiData = [];
  }

  // Mei Initialization
  public initMeiData(inputMeiHeader: string, body: any[]) {
    body.forEach((row, rowIndex) => {
      const mei = row[inputMeiHeader];
      if (mei) {
        this.meiData.push({
          mei: mei,
          row: rowIndex,
          isValid: null,
          errorMsg: null,
        });
      }
    });
  }

  // Getters
  public getMeiData() {
    return this.meiData;
  }

  // Update the mei data
  public updateMeiData(
    row: number,
    mei?: string,
    isValid?: boolean,
    errorMsg?: string,
  ) {
    const meiData = this.meiData.find((meiData) => meiData.row === row);
    if (meiData) {
      if (mei !== undefined) {
        meiData.mei = mei;
      }
      if (isValid !== undefined) {
        meiData.isValid = isValid;
      }
      if (errorMsg !== undefined) {
        meiData.errorMsg = errorMsg;
      }
    } else {
      this.meiData.push({
        row,
        mei: mei ?? meiData.mei,
        isValid: isValid ?? meiData.isValid,
        errorMsg: errorMsg ?? meiData.errorMsg,
      });
    }
  }

  public validateMei(cressTable, hook, changes?) {
    updateStatus('processing');

    let validationPromises = [];

    switch (hook) {
      case 'afterLoadData':
        this.getMeiData().forEach((mei) => {
          if (mei) {
            const validationPromise = this.validationTools
              .meiValidator(mei.mei)
              .then(([isValid, errorMsg]) => {
                this.updateMeiData(mei.row, mei.mei, isValid, errorMsg);
              });
            validationPromises.push(validationPromise);
          }
        });
        break;

      case 'afterChange':
        changes?.forEach(([row, prop, oldValue, newValue]) => {
          if (prop === 'mei' && oldValue !== newValue && newValue) {
            // validate the new edited mei data and update the validation status
            this.updateMeiData(row, newValue, undefined, undefined);
            const validationPromise = this.validationTools
              .meiValidator(newValue)
              .then(([isValid, errorMsg]) => {
                this.updateMeiData(row, undefined, isValid, errorMsg);
              });
            validationPromises.push(validationPromise);
          }
        });
    }

    Promise.all(validationPromises).then(() => {
      cressTable.render();

      const hasInvalid = this.meiData.some(
        (element) => element.isValid === false,
      );
      updateStatus('done', hasInvalid);
    });
  }

  // Mei Renderer Functions
  public meiRender(
    instance: Handsontable,
    td: HTMLElement,
    row: number,
    col: number,
    prop: string,
    value: any,
    cellProperties: Handsontable.CellProperties,
  ) {
    Handsontable.dom.empty(td);

    const mei = this.meiData.find((mei) => mei.row === row);
    if (mei) {
      if (mei.isValid === false) {
        // container for the invalid cell
        const invalidContainer = document.createElement('div');
        invalidContainer.className = 'invalid-container';

        // mei data
        const meiData = document.createElement('span');
        meiData.textContent = mei.mei;
        invalidContainer.appendChild(meiData);

        // tooltip icon and text
        const tooltipContainer = document.createElement('div');
        tooltipContainer.className = 'tooltip-container';

        const tooltipContent = document.createElement('div');
        tooltipContent.className = 'tooltip-text';
        tooltipContent.textContent = mei.errorMsg;

        const copyBtn = document.createElement('img');
        copyBtn.src = './Cress-gh/assets/img/copy-icon.svg';
        copyBtn.className = 'tooltip-copy';

        const tooltipIcon = document.createElement('img');
        tooltipIcon.src = './Cress-gh/assets/img/info-icon.svg';
        tooltipIcon.className = 'tooltip-icon';

        tooltipContent.appendChild(copyBtn);
        tooltipContainer.appendChild(tooltipContent);
        tooltipContainer.appendChild(tooltipIcon);
        invalidContainer.appendChild(tooltipContainer);

        td.appendChild(invalidContainer);
        td.style.backgroundColor = '#ffbeba';

        copyBtn.addEventListener('click', () => {
          // Copy the tooltipContent's text to the clipboard
          navigator.clipboard
            .writeText(mei.errorMsg)
            .then(() => {
              Notification.queueNotification('Copied to clipboard', 'success');
            })
            .catch((err) => {
              Notification.queueNotification('Failed to copy text', 'error');
              console.error('Failed to copy text: ', err);
            });
        });
      } else {
        td.textContent = mei.mei;
      }
    }

    return td;
  }
}
