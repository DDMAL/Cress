import Handsontable from 'handsontable';

export class MeiTools {
  private meiData: any[];

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
    errorMsg?: string[],
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

  // Mei Renderer Functions
  meiRender(
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
        const tooltipIcon = document.createElement('img');
        tooltipIcon.src = './Cress-gh/assets/img/info-icon.svg';
        tooltipIcon.className = 'tooltip-icon';
        invalidContainer.appendChild(tooltipIcon);
        const tooltipText = document.createElement('span');
        tooltipText.className = 'tooltip-text';
        tooltipText.textContent = mei.errorMsg.join('\n\n');
        invalidContainer.appendChild(tooltipText);
        tooltipIcon.addEventListener('mouseover', () => {
          tooltipText.style.display = 'block';
        });
        tooltipIcon.addEventListener('mouseout', () => {
          tooltipText.style.display = 'none';
        });

        td.appendChild(invalidContainer);
      } else {
        td.textContent = mei.mei;
      }
    }

    return td;
  }
}
