import setBody from './utils/Template';
import * as Validation from './Validation';
import { ModalWindow } from './utils/ModalWindow';
import { EditableTable } from './utils/EditableTable';
import { ModalWindowInterface } from './Interfaces';
import { setSavedStatus, listenUnsavedChanges } from './utils/Unsaved';
import { CressDoc } from './Types';

/**
 * CressView class. Manages the other modules of Cress and communicates with
 * CressCore.
 */
class CressView {
  /** ID of the document loaded. */
  id: string;
  /** Name of the document loaded. */
  name: string;
  /** Content of the document loaded. */
  header: string[];
  body: any[];
  /** Module that controls state and content of Cress modal windows */
  modal: ModalWindowInterface;
  /** Spreadsheet module */
  table: EditableTable;

  /**
   * Constructor for CressView. Sets mode and passes constructors.
   */
  constructor(cressDoc: CressDoc) {
    this.id = cressDoc.id;
    this.name = cressDoc.name;
    this.header = cressDoc.header;
    this.body = cressDoc.body;
  }

  /**
   * Start Cress
   */
  start(): void {
    setBody(this)
      .then(() => {
        // load the components
        this.modal = new ModalWindow();
        listenUnsavedChanges();

        document.getElementById('loading').style.display = 'none';

        this.table = new EditableTable(this.header, this.body);

        return;
      })
      .then(() => {});
  }

  /**
   * Save the current state to the browser database.
   */
  // save (): Promise<void> {
  //   setSavedStatus(true);
  //   return this.core.updateDatabase();
  // }

  /**
   * Deletes the local database of the loaded MEI file(s).
   */
  // deleteDb (): Promise<void[]> {
  //   return this.core.deleteDb();
  // }
}

export { CressView as default };
