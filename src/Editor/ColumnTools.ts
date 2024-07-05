
export class ColumnTools {
  public validationInProgress = false;
  public pendingValidations = 0;
  public hasInvalid = false;

  constructor(private inputHeader: string[]) {}

  getColumns(headers: string[]) {
    const columns = [];
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes('image')) {
        let inputImgHeader = this.inputHeader.find((header) =>
          header.includes('image'),
        );
        columns.push({
          data: inputImgHeader,
          renderer: 'imgRenderer',
          readOnly: false,
        });
      } else if (headers[i].includes('mei')) {
        columns.push({
          data: headers[i],
          renderer: 'meiRenderer',
        });
      } else {
        columns.push({
          data: headers[i],
        });
      }
    }
    return columns;
  }

  getColWidths(headers: string[]) {
    return headers.map((header) => (header.includes('mei') ? 200 : 100));
  }

  getIndices(body: any[]) {
    return body.map((_, index) => index + 1);
  }

  getMeiData(body: any[]) {
    return body.map((row) => row.mei);
  }

  /**
   * Convert all the quote signs to inch marks if any
   * Called automatically on loading
   * @param body
   */
  convertMeiQuoteSign(body: any[]) {
    for (let i = 0; i < body.length; i++) {
      body[i].mei = body[i].mei.replace(/“/g, '"').replace(/”/g, '"');
    }
  }
}
