import Handsontable from 'handsontable';
import { updateStatus } from './ValidationTools';
export class MeiTools {
  private meiData: any[];
  public validationInProgress = false;
  public pendingValidations = 0;
  public hasInvalid = false;

  constructor() {
    this.meiData = [];
  }

  // Mei Initialization
  public initMeiData(inputMeiHeader: string, body: any[]) {
    body.forEach((row, rowIndex) => {
      const mei = row[inputMeiHeader];
      if (mei) {
        this.meiData.push({
          mei,
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

  public setProcessStatus(value: any) {
    if (!this.validationInProgress) {
      this.validationInProgress = true;
      updateStatus('processing');
    }
    // Update `pendingValidations` if value is not empty
    if (value) this.pendingValidations++;
  }

  public setResultStatus(isValid: boolean) {
    if (!isValid) this.hasInvalid = true;
    this.pendingValidations--;
    if (this.pendingValidations === 0) {
      this.validationInProgress = false;
      updateStatus('done', this.hasInvalid);
      this.hasInvalid = false;
    }
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
        const tooltipText = document.createElement('span');
        tooltipText.className = 'tooltip-text';
        tooltipText.textContent = mei.errorMsg;

        const tooltipIcon = document.createElement('img');
        tooltipIcon.src = './Cress-gh/assets/img/info-icon.svg';
        tooltipIcon.className = 'tooltip-icon';

        invalidContainer.appendChild(tooltipText);
        invalidContainer.appendChild(tooltipIcon);

        tooltipIcon.addEventListener('mouseover', () => {
          tooltipText.style.display = 'block';
        });
        tooltipIcon.addEventListener('mouseout', () => {
          tooltipText.style.display = 'none';
        });

        td.appendChild(invalidContainer);
        td.style.backgroundColor = '#ffbeba';
      } else {
        td.textContent = mei.mei;
      }
    }

    return td;
  }
}
