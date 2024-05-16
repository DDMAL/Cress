
import setBody from './utils/Template';
import { ModalWindow } from './utils/ModalWindow';
import { EditableTable } from './utils/EditableTable';
import {
  ModalWindowInterface,
} from './Interfaces';
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
  glyphs: any[];
  /** Module that controls state and content of Cress modal windows */
  modal: ModalWindowInterface;

  /**
   * Constructor for CressView. Sets mode and passes constructors.
   */
  constructor (cressDoc: CressDoc) {
    this.id = cressDoc.id;
    this.name = cressDoc.name;
    this.glyphs = cressDoc.glyphs;
  }

  /**
   * Start Cress
   */
  start (): void {
    setBody(this).then(() => {
      // load the components
      // this.view = new this.params.View(this, this.params.Display, this.manifest.image);
      this.modal = new ModalWindow();
      listenUnsavedChanges();

      document.getElementById('loading').style.display = 'none';

      new EditableTable(this.glyphs);

      return;
    }).then(() => {
      // load the SVG
      // return this.updateForCurrentPage(true);
    }).then(() => {
    });
  }

  /**
   * Get the current page from the loaded view and then display the
   * most up to date SVG.
   */
  // updateForCurrentPage (delay = false): Promise<void> {
  //   const pageNo = this.view.getCurrentPage();
  //   return this.view.changePage(pageNo, delay);
  // }

  /**
   * Redo an action performed on the current page (if there is one).
   */
  // redo (): Promise<boolean> {
  //   setSavedStatus(false);
  //   return this.core.redo(this.view.getCurrentPageURI());
  // }

  /**
   * Undo the last action performed on the current page (if there is one).
   */
  // undo (): Promise<boolean> {
  //   setSavedStatus(false);
  //   return this.core.undo(this.view.getCurrentPageURI());
  // }

  /**
   * Attempt to perform an editor action.
   * @param action - The editor toolkit action object.
   * @param pageURI - The URI of the page to perform the action on
   */
  // edit (action: EditorAction, pageURI: string): Promise<boolean> {
  //   return this.core.edit(action, pageURI);
  // }

  /**
   * Updates browser database and creates JSON-LD save file.
   * @returns The contents of this file.
   */
  export (): Promise<string | ArrayBuffer> {
    return (new Promise((resolve, reject): void => {
      // this.core.updateDatabase().then(() => {
      //   this.manifest['mei_annotations'] = this.core.getAnnotations();
      //   this.manifest.timestamp = (new Date()).toISOString();
      //   const data = new window.Blob([JSON.stringify(this.manifest, null, 2)], { type: 'application/ld+json' });
      //   const reader = new FileReader();
      //   reader.addEventListener('load', () => {
      //     resolve(reader.result);
      //   });
      //   reader.readAsDataURL(data);
      // }).catch(err => { reject(err); });
    }));
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
