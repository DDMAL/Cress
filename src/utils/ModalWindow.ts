import { ModalWindowInterface } from '../Interfaces';
import { hotkeysModal } from '../Contents';
import {
  newFolderHTML,
  renameHTML,
  uploadAreaHTML,
} from '../Dashboard/DashboardContent';

/**
 * Defines modal types.
 * To create new modal window types, add enum option and implement logic inside Modal class.
 */
export enum ModalWindowView {
  HOTKEYS,
  ERROR_LOG, // for validation errors against MEI schema and invalid element errors
  DOCUMENT_UPLOAD,
  MOVE_TO,
  NEW_FOLDER,
  RENAME,
}

enum ModalWindowState {
  OPEN,
  CLOSED,
}

/**
 * Modal class is used to create and control state/content
 * of modal windows in cress.
 */
export class ModalWindow implements ModalWindowInterface {
  private modalWindowView: ModalWindowView; // current modal type
  private modalWindowState: ModalWindowState; // open or closed?

  constructor() {
    this.modalWindowState = ModalWindowState.CLOSED;
    this.setupEventListeners();
  }

  /**
   * Set event listeners that apply to all modal windows
   */
  private setupEventListeners() {
    document
      .getElementById('cress-modal-window-header-close')
      .addEventListener('click', this.hideModalWindow.bind(this));
    document
      .getElementById('cress-modal-window')
      .addEventListener('keydown', this.keydownListener.bind(this));
    document
      .getElementById('cress-modal-window-container')
      .addEventListener('click', this.focusModalWindow.bind(this));
  }

  /**
   * Remove event listeners associated with this modal window
   */
  private removeEventListeners() {
    document
      .getElementById('cress-modal-window-header-close')
      .removeEventListener('click', this.hideModalWindow.bind(this));
    document
      .getElementById('cress-modal-window')
      .removeEventListener('keydown', this.keydownListener.bind(this));
    document
      .getElementById('cress-modal-window-container')
      .removeEventListener('click', this.focusModalWindow.bind(this));
  }

  /**
   * Set the modal view of this Modal instance.
   * Update the content based on passed view.
   * @param view Type of modal to open (ModalView enum)
   */
  setModalWindowView(view: ModalWindowView, content?: string): void {
    this.modalWindowView = view;
    this.setModalWindowContent(content);
  }

  /**
   * Return the current modal view as a string
   */
  getModalWindowView(): string {
    return this.modalWindowView.toString();
  }

  /**
   * Open a model window with content representing the current ModalView.
   */
  openModalWindow(): void {
    // make sure no other modal content is being displayed
    Array.from(
      document.getElementsByClassName('cress-modal-window-content'),
    ).forEach((elem) => {
      elem.classList.remove('visible');
    });
    switch (this.modalWindowView) {
      case ModalWindowView.HOTKEYS:
        // set up and diplay hotkey modal content
        document
          .getElementById('cress-modal-window-content-hotkeys')
          .classList.add('visible');

      case ModalWindowView.DOCUMENT_UPLOAD:
      // add function to pairing button
      // break;

      case ModalWindowView.MOVE_TO:

      // break;
      case ModalWindowView.NEW_FOLDER:

      case ModalWindowView.RENAME:

      default:
        document.getElementById('cress-modal-window-container').style.display =
          'flex';
        this.focusModalWindow();
        break;
    }
    // make sure user can't scroll when modal is open
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden';
    this.modalWindowState = ModalWindowState.OPEN;
  }

  /**
   * Hide the cress modal window
   */
  hideModalWindow(): void {
    switch (this.modalWindowView) {
      case ModalWindowView.DOCUMENT_UPLOAD:
      case ModalWindowView.MOVE_TO:
      case ModalWindowView.NEW_FOLDER:
      case ModalWindowView.RENAME:
        document.getElementById(
          'cress-modal-window-content-container',
        ).innerHTML = '';
        break;

      default:
        break;
    }
    document.getElementById('cress-modal-window-container').style.display =
      'none';
    // reset scroll behavior of body
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'scroll';
    this.modalWindowState = ModalWindowState.CLOSED;
    this.removeEventListeners();
  }

  /**
   * Set content of modal window
   */
  private setModalWindowContent(content?: string): void {
    const container = document.getElementById(
      'cress-modal-window-content-container',
    );
    const title = document.getElementById('cress-modal-window-header-title');

    switch (this.modalWindowView) {
      case ModalWindowView.HOTKEYS:
        container.innerHTML = hotkeysModal;
        title.innerText = 'HOTKEYS';
        break;

      case ModalWindowView.ERROR_LOG:
        container.innerHTML = `<div style="margin-bottom: 30px;white-space: pre-line;overflow-y: scroll;">${content}</div>
          <div class="cress-modal-window-btn">
            <a href="data:text/plain;charset=utf-8,${encodeURI(
              content,
            )}" download="error.log">
              Export
            </a>
            </div>`;
        title.innerText = 'ERROR LOG';
        break;

      case ModalWindowView.DOCUMENT_UPLOAD:
        title.innerText = 'DOCUMENT UPLOAD';
        container.innerHTML = uploadAreaHTML;
        break;

      case ModalWindowView.MOVE_TO:
        title.innerText = 'MOVE TO';
        break;

      case ModalWindowView.NEW_FOLDER:
        title.innerText = 'NEW FOLDER';
        container.innerHTML = newFolderHTML;
        break;

      case ModalWindowView.RENAME:
        title.innerText = 'RENAME';
        container.innerHTML = renameHTML;
        break;

      default:
        console.error('Unknown selection type. This should not have occurred.');
    }
  }

  /**
   * Fill modal window with content for updating syllable text
   */
  private openEditSylTextModalWindow = function (): void {
    // make sure no other modal content is being displayed
    Array.from(
      document.getElementsByClassName('cress-modal-window-content'),
    ).forEach((elem) => {
      elem.classList.remove('visible');
    });

    // set up Edit Syllable Text modal window
    document
      .getElementById('cress-modal-window-content-edit-text')
      .classList.add('visible');

    // Reset "Cancel" button event listener
    document
      .getElementById('cress-modal-window-edit-text-cancel')
      .removeEventListener('click', this.hideModalWindow);
    document
      .getElementById('cress-modal-window-edit-text-cancel')
      .addEventListener('click', this.hideModalWindow.bind(this));

    // Reset "Save" button event listener
    document
      .getElementById('cress-modal-window-edit-text-save')
      .removeEventListener('click', this.updateSylText.bind(this));
    document
      .getElementById('cress-modal-window-edit-text-save')
      .addEventListener('click', this.updateSylText.bind(this));

    // display modal window
    document.getElementById('cress-modal-window-container').style.display =
      'flex';
    this.focusModalWindow();
  };

  /**
   * Update text of selected-to-edit syllables with user-provided text
   */
  private updateSylText = function () {
    // close modal window
    this.hideModalWindow();
  };

  /**
   * Update the bounding box selected when the edit text modal has been clicked
   */
  updateSelectedBBox(span: HTMLSpanElement): void {}

  /**
   * Fill modal window with hotkey info content
   */
  /*
  private openHotkeyModalWindow = function() {
    // make sure no other modal content is being displayed
    Array.from(document.getElementsByClassName('cress-modal-window-content')).forEach((elem) => {
      elem.classList.remove('visible');
    });

    // set up and diplay hotkey modal content
    document.getElementById('cress-modal-window-content-hotkeys').classList.add('visible');

    document.getElementById('cress-modal-window-container').style.display = 'flex';
    this.focusModalWindow();
  };
  */

  /**
   * Define event listeners for modal window based on modalView type
   */
  private keydownListener = function (e) {
    e.stopImmediatePropagation(); // prevent cress hotkey events from firing when user is typing

    if (e.key === 'Escape') this.hideModalWindow();
  };

  /**
   * Event listener that focuses the modal window if user clicks anywhere outside of it
   */
  private focusModalWindow = function () {
    switch (this.modalWindowView) {
      case ModalWindowView.DOCUMENT_UPLOAD:
      case ModalWindowView.NEW_FOLDER:
      case ModalWindowView.RENAME:
        break;
      default:
        document.getElementById('cress-modal-window').focus();
    }
  };
}
