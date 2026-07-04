import {
  IEntry,
  IFile,
  IFolder,
  FileSystemTools,
  EntryType,
} from './FileSystem';
import { deleteDocument, updateDocName, addDocument } from './Storage';
import { FileSystemManager } from './FileSystem';
import { ShiftSelectionManager, dashboardState } from './DashboardTools';
import { InitUploadArea } from './UploadArea';
import * as contextMenuContent from './ContextMenuContent';
import { ModalWindow, ModalWindowView } from '../utils/ModalWindow';
import { v4 as uuidv4 } from 'uuid';
import {
  getMappingStorage,
  nameToPath,
  listIndexedForeignUsers,
} from './githubStorage/createMappingStorage';
import { ConflictError } from './githubStorage/backend';

const documentsContainer: HTMLDivElement = document.querySelector(
  '#fs-content-container',
);
const backgroundArea: HTMLDivElement = document.querySelector(
  '#main-section-content',
);
const openButton: HTMLButtonElement = document.querySelector('#open-doc');
const removeButton: HTMLButtonElement = document.querySelector('#remove-doc');
const navPathContainer: HTMLDivElement = document.querySelector(
  '#nav-path-container',
);
let backButton: HTMLButtonElement = document.querySelector('#fs-back-btn');
let emptyButton: HTMLButtonElement = document.querySelector('#fs-empty-btn');
let deleteButton: HTMLButtonElement = document.querySelector('#fs-delete-btn');
const uploadDocumentsButton: HTMLButtonElement = document.querySelector(
  '#upload-new-doc-button',
);
const newFolderButton: HTMLButtonElement =
  document.querySelector('#add-folder-button');
const newFileButton: HTMLButtonElement =
  document.querySelector('#add-file-button');

const shiftSelection = new ShiftSelectionManager();
const fsm = FileSystemManager();
const state = dashboardState();

const mainSection: HTMLElement = document.querySelector(
  '.main-section-content',
);
const contextMenu: HTMLElement = document.querySelector(
  '.right-click-file-menu',
);
const contextMenuContentWrapper: HTMLElement = document.querySelector(
  '.context-menu-items-wrapper',
);

let metaKeyIsPressed = false;
let shiftKeyIsPressed = false;
let currentDragTarget = null;
let rightClicked = false;

openButton?.addEventListener('click', openDocsHandler);
removeButton?.addEventListener('click', removeDocsHandler);
uploadDocumentsButton?.addEventListener('click', openUploadAreaHandler);
newFolderButton?.addEventListener('click', openNewFolderWindow);
newFileButton?.addEventListener('click', openNewFileWindow);

// Sorting algorithms
// const sortByAlphanumerical = (a: IEntry, b: IEntry) => a.name.localeCompare(b.name);
// const sortByTime = (a: IEntry, b: IEntry) => {
//   const aTime = a.metadata['created_on'];
//   const bTime = b.metadata['created_on'];
//   if (aTime && bTime) return aTime - bTime;
//   else if (aTime) return -1;
// };

window.addEventListener('keydown', (e) => {
  if (e.metaKey) metaKeyIsPressed = true;
  if (e.shiftKey) shiftKeyIsPressed = true;
  // Lose focus on esc key
  if (e.key === 'Escape') {
    unselectAll();
    shiftSelection.reset();
    updateActionBarButtons();
    updateFSButtons();
  }
});

window.addEventListener('keyup', (e) => {
  if (!e.metaKey) metaKeyIsPressed = false;
  if (!e.shiftKey) shiftKeyIsPressed = false;
});

backgroundArea?.addEventListener('click', (e) => {
  const target = e.target as Element;
  // Lose focus if click event in main section is not a document tile
  const isDocument = Boolean(target.closest('.document-entry'));
  if (!isDocument) {
    unselectAll();
    shiftSelection.reset();
    updateActionBarButtons();
    updateFSButtons();
  }
});

/**
 *
 * @returns
 */
function openUploadAreaHandler() {
  if (!uploadDocumentsButton.classList.contains('active')) return;
  InitUploadArea(state.getParentFolder());
}

/**
 * Opens a new tab with the Cress editor for the given id
 *
 * @param id key of file in bbb or manifest url
 * @param isSample boolean to decide where to fetch file
 */
function openEditorTab(id: string, isSample: boolean) {
  const params = isSample ? { sample: id } : { upload: id };
  const query = makeQuery(params);
  window.open(`./editor.html?${query}`, '_blank');
}

/**
 * Opens editor tab given a document tile element
 *
 * @param entry
 */
function openFile(entry: IFile) {
  const documentType = entry.metadata['document'];
  if (typeof documentType !== undefined) {
    const isSample = documentType === 'sample';
    openEditorTab(entry.id, isSample);
  }
}

/**
 *
 * @param obj
 * @returns
 */
function makeQuery(obj): string {
  return Object.keys(obj)
    .map((key) => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
    })
    .join('&');
}

/**
 *
 * @param index
 */
function select(index: number) {
  const entry = state.getEntries().at(index);
  state.setSelection(index, true);
  const tile = document.getElementById(entry.id);
  tile.classList.add('selected');
}

/**
 *
 * @param index
 */
function unselect(index: number) {
  const id = state.getEntries().at(index).id;
  state.setSelection(index, false);
  const tile = document.getElementById(id);
  tile.classList.remove('selected');
}

/**
 *
 */
function unselectAll() {
  Array.from(document.querySelectorAll('.document-entry.selected')).forEach(
    (tile) => tile.classList.remove('selected'),
  );
  state.resetSelection();
}

/**
 * Creates a folder or file tile element given an entry
 * @param entry IEntry
 * @returns HTMLDivElement tile element
 */
function createTile(entry: IEntry) {
  const container = document.createElement('div');
  container.classList.add('document-entry');
  container.setAttribute('draggable', 'true'); // make file or folder draggable

  const icon = document.createElement('img');
  icon.classList.add('document-icon');
  const name = document.createElement('div');
  name.innerText = entry.name;

  switch (entry.type) {
    case 'folder':
      // set type attrib and id
      container.classList.add('folder-entry');
      container.setAttribute('id', entry.id);
      // set icon
      icon.src = './Cress-gh/assets/img/folder-icon.svg';
      // set drop target attrib
      container.setAttribute('drop-id', entry.id);
      container.classList.add('drop-target');
      break;
    case 'trash':
      // set type attrib and id
      container.classList.add('folder-entry');
      container.setAttribute('id', entry.id);
      // set icon
      icon.src = './Cress-gh/assets/img/trash-icon.svg';
      // set drop target attrib
      container.setAttribute('drop-id', entry.id);
      container.classList.add('drop-target');
      break;
    case 'file':
      container.classList.add('file-entry');
      container.setAttribute('id', (entry as IFile).id);

      // determine which icon and class to add depending on existing metadata
      if (entry.metadata['type'] === 'manuscript') {
        // set type attrib and id
        container.classList.add('manuscript-entry');
        // set icon
        icon.src = './Cress-gh/assets/img/manuscript-icon.svg';
      } else if (entry.metadata['type'] === 'folio') {
        // set type attrib and id
        container.classList.add('folio-entry');
        // set icon
        icon.src = './Cress-gh/assets/img/folio-icon.svg';
      } else {
        // set icon for no type
        icon.src = './Cress-gh/assets/img/folio-icon.svg';
      }

      break;
  }

  container.appendChild(icon);
  container.appendChild(name);

  return container;
}

/**
 * Adds dblclick event listener to tile element and adds shift selection behaviour
 *
 * @param index as displayed on dashboard to user
 * @param entry corresponding entry in current folder
 * @param tile HTMLDivElement
 */
async function addTileEventListener(
  index: number,
  entry: IEntry,
  tile: HTMLDivElement,
) {
  // double click event immediately opens document
  if (entry.type === 'folder') {
    async function enterFolder() {
      return await updateDashboard([
        ...state.getFolderPath(),
        entry as IFolder,
      ]);
    }
    tile.addEventListener('dblclick', enterFolder, false);
  } else {
    tile.addEventListener('dblclick', openDocsHandler, false);
  }
  addShiftSelectionListener(tile, index);
  addSpecificContextMenuListeners(tile, index);
}

/**
 * Add shift selection behaviour to html tile element
 *
 * When no keys are pressed: erase any previous selections and select only current tile
 * When meta key is pressed: add current tile to selection if not already selected, else remove from
 * selection. When shift key is pressed: select all tiles between current tile and previous tile
 *
 * When there is a previous selection, the start of the shift selection is the last selected tile.
 * Shift clicking after will add the shift selection to the previous selection.
 *
 * @param tile
 * @param index
 */
function addShiftSelectionListener(tile: HTMLDivElement, index: number) {
  tile.addEventListener(
    'click',
    function (_e) {
      shiftSelectionHandler(index);
    },
    false,
  );
}

function shiftSelectionHandler(index) {
  if (!metaKeyIsPressed && !shiftKeyIsPressed) {
    unselectAll();
    select(index);
    shiftSelection.setStart(index);
  } else if (metaKeyIsPressed) {
    if (state.getSelection()[index]) {
      unselect(index);
      shiftSelection.setStart(state.getSelection().lastIndexOf(true));
    } else {
      select(index);
      shiftSelection.setStart(index);
    }
  } else if (shiftKeyIsPressed) {
    shiftSelection.getPrevSelection().forEach((idx) => {
      unselect(idx);
    });
    shiftSelection.setEnd(index);
    shiftSelection.getSelection(state.getSelection()).forEach((idx) => {
      select(idx);
    });
  }
  updateActionBarButtons();
  updateFSButtons();
}
/**
 * Opens current selection of documents on dashboard.
 *
 * If a folder is selected, opens folder.
 * If a file(s) is selected, opens file(s).
 * If a folder and file(s) are selected, opens file(s).
 */
function openDocsHandler() {
  if (!openButton.classList.contains('active')) return;

  // Open folder if only one folder is selected
  if (
    state.getSelectedFolders().length === 1 ||
    state.getSelectedTrash().length === 1
  ) {
    const newPath = [
      ...state.getFolderPath(),
      state.getSelectedEntries()[0] as IFolder,
    ];
    updateDashboard(newPath);
    return;
  }

  // Open all files, ignoring if folders are selected
  state.getSelectedFiles().forEach((entry: IEntry) => openFile(entry as IFile));
  shiftSelection.reset();
  unselectAll();
  updateActionBarButtons();
}

/**
 * Move current selection of documents on dashboard to trash.
 *
 */
function removeDocsHandler() {
  if (!removeButton.classList.contains('active')) return;

  const selectedEntries = state.getSelectedEntries();
  const parentFolder = state.getParentFolder();
  const trashFolder = state.getTrashFolder();

  const datetime = new Date().toLocaleString();

  for (let entry of selectedEntries) {
    entry = FileSystemTools.addMetadata(entry, {
      removed_on: datetime,
      recover_folder: state.getFolderPathNames(),
    });
  }

  // Remote .trash/ sync is handled centrally in moveToFolder (covers button +
  // drag paths uniformly), so we just do the local move here.
  moveToFolder(selectedEntries, parentFolder, trashFolder);
}

function putBackDocsHandler() {
  const selectedEntries = state.getSelectedEntries();
  const parentFolder = state.getParentFolder();

  for (let entry of selectedEntries) {
    const folderPathNames = entry.metadata['recover_folder'] as string[];
    const targetFolder = state.getFolderPathByNames(folderPathNames);
    if (targetFolder) {
      entry = FileSystemTools.removeMetadata(entry, [
        'removed_on',
        'recover_folder',
      ]);
      const dateTimePattern =
        / - \d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [APMapm]{2}$/;

      // Check if the filename ends with the date time pattern
      if (dateTimePattern.test(entry.name)) {
        entry.name = entry.name.replace(dateTimePattern, '');
      }
      // Remote restore is handled centrally in moveToFolder (covers this button
      // path AND drag-out-of-trash uniformly).
      moveToFolder([entry], parentFolder, targetFolder);
    }
  }
}

/**
 * Delete a file
 *
 * @param file
 * @param parentFolder
 * @returns
 */

async function deleteFileEntry(
  file: IFile,
  parentFolder: IFolder,
): Promise<boolean> {
  try {
    // LOCAL-ONLY delete. The GitHub side is append-only: the remote copy was
    // already moved to .trash/ when the file was sent to Trash (see
    // removeDocsHandler -> moveToFolder -> trashRemote), so permanent deletes
    // here (Empty Trash / 30-day cleanup / Delete in Trash) must NOT touch the
    // remote -- the .trash/ copy stays recoverable.
    await deleteDocument(file.id);
    FileSystemTools.removeEntry(file, parentFolder);
    return true;
  } catch (err) {
    console.error('deleteFileEntry failed:', err);
    return false;
  }
}

/**
 * Delete a folder and its content
 *
 * @param folder
 * @param parentFolder
 * @returns
 */
function deleteFolderEntry(
  folder: IFolder,
  parentFolder: IFolder,
): Promise<boolean> {
  return new Promise((resolve) => {
    const deletePromises = folder.children.map((child) => {
      if (child.type === 'file') {
        return deleteFileEntry(child as IFile, folder); // Pass the current folder as the parent
      } else if (child.type === 'folder') {
        return deleteFolderEntry(child as IFolder, folder); // Pass the current folder as the parent
      }
      return Promise.resolve(false); // Shouldn't happen, but resolving for safety
    });

    Promise.all(deletePromises)
      .then(() => {
        FileSystemTools.removeEntry(folder, parentFolder); // Use the provided parent folder
        resolve(true);
      })
      .catch(() => resolve(false));
  });
}

/**
 * Deletes current selection of documents on dashboard.
 *
 * If a folder is selected, deletes folder.
 * If a file(s) is selected, deletes file(s).
 * If a folder and file(s) are selected, deletes all.
 */
function deleteDocsHandler() {
  const allEntries = state.getSelectedEntries();

  // Create a formatted list of filenames to display in alert message
  const createList = (entryArray: IEntry[]) =>
    entryArray.map((entry) => `- ${entry.name} (${entry.type})`).join('\n');

  const alertMessage = `Are you sure you want to delete:\n${createList(
    allEntries,
  )}\nThis action is irreversible.`;

  const isConfirmed = window.confirm(alertMessage);

  if (isConfirmed) {
    const deletePromises = allEntries.map((entry) => {
      if (entry.type === 'file') {
        return deleteFileEntry(entry as IFile, state.getParentFolder());
      } else if (entry.type === 'folder') {
        return deleteFolderEntry(entry as IFolder, state.getParentFolder());
      }
    });

    Promise.all(deletePromises)
      .then(() => {
        updateDashboard(state.getFolderPath());
      })
      .catch((err) => console.debug('failed to delete files: ', err));
  }
}

function emptyTrashHandler() {
  const trashFolder = state.getTrashFolder();

  if (!trashFolder) {
    console.error('Trash folder not found.');
    return;
  }

  const alertMessage =
    'Are you sure you want to delete all the files in Trash Folder?\nThis action is irreversible.';

  const isConfirmed = window.confirm(alertMessage);

  if (isConfirmed) {
    const deletePromises = trashFolder.children.map((entry) => {
      if (entry.type === 'file') {
        return deleteFileEntry(entry as IFile, trashFolder);
      } else if (entry.type === 'folder') {
        return deleteFolderEntry(entry as IFolder, trashFolder);
      }

      return Promise.resolve(false); // Shouldn't happen, but resolving for safety
    });

    Promise.all(deletePromises)
      .then(() => {
        // After deleting all content, update the dashboard
        updateDashboard(state.getFolderPath());
      })
      .catch((err) => console.debug('failed to delete files: ', err));
  }
}

/**
 * Updates the visibility of action bar buttons based on current selections
 *
 * Note: better not to change the order
 */
function updateActionBarButtons() {
  // inside ./Samples or selecting the samples folder
  if (
    state.getParentFolder().metadata['immutable'] ||
    (state.getSelectedEntries()[0] &&
      state.getSelectedEntries()[0].metadata['immutable'])
  ) {
    uploadDocumentsButton.classList.remove('active');
    newFolderButton.classList.remove('active');
    newFileButton.classList.remove('active');
    removeButton.classList.remove('active');
    if (state.getSelectedEntries().length) {
      openButton.classList.add('active');
    } else {
      openButton.classList.remove('active');
    }
  }
  // inside ./Trash
  else if (state.isInTrash()) {
    uploadDocumentsButton.classList.remove('active');
    newFolderButton.classList.remove('active');
    newFileButton.classList.remove('active');
    removeButton.classList.remove('active');
    openButton.classList.remove('active');
  }
  // selecting the trash folder
  else if (state.getSelectedTrash().length) {
    openButton.classList.add('active');
    removeButton.classList.remove('active');
    uploadDocumentsButton.classList.remove('active');
    newFolderButton.classList.remove('active');
    newFileButton.classList.remove('active');
  }
  // selecting entries
  else if (state.getSelectedEntries().length) {
    openButton.classList.add('active');
    removeButton.classList.add('active');
    uploadDocumentsButton.classList.remove('active');
    newFolderButton.classList.remove('active');
    newFileButton.classList.remove('active');
  }
  // nothing selected, not in ./Samples or ./Trash
  else {
    openButton.classList.remove('active');
    removeButton.classList.remove('active');
    uploadDocumentsButton.classList.add('active');
    newFolderButton.classList.add('active');
    newFileButton.classList.add('active');
  }
}

/**
 * Updates the nav path with current folder path
 */
function updateNavPath(): void {
  navPathContainer.innerHTML = '';

  // create nav elements and add event listeners
  const navElements = state.getFolderPath().map((folder, idx) => {
    const navSection = document.createElement('div');
    navSection.classList.add('nav-path-section');
    navSection.innerHTML = folder.name;

    const targetPath = state.getFolderPath().slice(0, idx + 1);
    navSection.addEventListener(
      'click',
      async () => await updateDashboard(targetPath),
    );
    // add drop target to move dragged element to the prospective folders
    addDropTargetListeners(
      navSection,
      state.getParentFolder(),
      targetPath.at(-1),
    );

    return navSection;
  });

  // add nav elements to nav path container
  navElements.forEach((navElement, idx) => {
    navPathContainer.appendChild(navElement);
    if (idx !== navElements.length - 1) {
      const seperator = document.createElement('div');
      seperator.classList.add('nav-path-seperator');
      seperator.innerHTML = ' / ';
      navPathContainer.appendChild(seperator);
    }
  });
}

/**
 * Updates the back button with click event listener to go back one folder if possible
 */
function updateBackButton() {
  // Erase previous event listeners
  const buttonClone = backButton.cloneNode(true) as HTMLButtonElement;
  backButton.parentNode.replaceChild(buttonClone, backButton);

  // Disable back button if at root
  const isRoot = state.getFolderPath().length === 1;
  if (isRoot) {
    buttonClone.classList.remove('active');
    buttonClone.setAttribute('disabled', 'true');
  } else {
    buttonClone.classList.add('active');
    buttonClone.removeAttribute('disabled');
    buttonClone.addEventListener('click', handleNavigateBack);
    buttonClone.addEventListener('ondragenter', () =>
      buttonClone.classList.add('active'),
    );
    buttonClone.addEventListener('ondragleave', () =>
      buttonClone.classList.remove('active'),
    );
    addDropTargetListeners(
      buttonClone,
      state.getParentFolder(),
      state.getFolderPath().at(-2),
    );
  }
  backButton = buttonClone;
}

function updateEmptyButton() {
  // Erase previous event listeners
  const buttonClone = emptyButton.cloneNode(true) as HTMLButtonElement;
  emptyButton.parentNode.replaceChild(buttonClone, emptyButton);

  const parentFolder = state.getParentFolder();

  // Display if in trash
  if (parentFolder.type === 'trash' || state.isInTrash()) {
    buttonClone.style.display = '';

    // Activate button if has content and not selecting when first level parent is trash
    if (
      parentFolder.children.length &&
      !state.getSelectedEntries().length &&
      parentFolder.type === 'trash'
    ) {
      buttonClone.classList.add('active');
      buttonClone.removeAttribute('disabled');
      buttonClone.addEventListener('click', emptyTrashHandler);
    }
    // Disable button if no content
    else {
      buttonClone.classList.remove('active');
      buttonClone.setAttribute('disabled', 'true');
    }
  } else {
    buttonClone.style.display = 'none';
  }
  emptyButton = buttonClone;
}

function updateDeleteButton() {
  // Erase previous event listeners
  const buttonClone = deleteButton.cloneNode(true) as HTMLButtonElement;
  deleteButton.parentNode.replaceChild(buttonClone, deleteButton);

  const parentFolder = state.getParentFolder();
  // Display if in trash
  if (parentFolder.type === 'trash' || state.isInTrash()) {
    buttonClone.style.display = '';

    // Add listener if selects entries
    if (state.getSelectedEntries().length) {
      buttonClone.classList.add('active');
      buttonClone.removeAttribute('disabled');
      buttonClone.addEventListener('click', deleteDocsHandler);
    }
    // Disable if nothing selected
    else {
      buttonClone.classList.remove('active');
      buttonClone.setAttribute('disabled', 'true');
    }
  } else {
    buttonClone.style.display = 'none';
  }
  deleteButton = buttonClone;
}

function updateFSButtons() {
  updateBackButton();
  updateEmptyButton();
  updateDeleteButton();
}

/**
 * Handles click event on back button to go back one folder if possible
 */
async function handleNavigateBack() {
  const newPath = state.getFolderPath().slice(0, -1);
  await updateDashboard(newPath);
}

/**
 * Add new Folder to current folder and refresh dashboard
 */
function handleAddFolder(folderName: string) {
  // create new folder element
  const newFolderTile = document.createElement('div');
  newFolderTile.classList.add('document-entry');
  newFolderTile.classList.add('folder-entry');
  newFolderTile.setAttribute('id', 'new-folder');

  const newFolder = FileSystemTools.createFolder(folderName);
  const succeeded = FileSystemTools.addEntry(
    newFolder,
    state.getParentFolder(),
  );
  if (succeeded) {
    newFolderTile.setAttribute('id', folderName);
    updateDashboard();
    return true;
  } else {
    newFolderTile.remove();
    return false;
  }
}

/**
 * Add new File to current folder and refresh dashboard
 */
function handleAddFile(fileName: string, rowNum: number) {
  // create new file element
  const newFileTile = document.createElement('div');
  newFileTile.classList.add('document-entry');
  newFileTile.classList.add('file-entry');
  newFileTile.setAttribute('id', 'new-file');

  const newFileId = uuidv4();

  // add new empty json file to db
  const headers = ['image', 'name', 'classification', 'mei'];
  const data = Array(rowNum).fill({});
  data.forEach((row) => {
    headers.forEach((header) => {
      row[header] = '';
    });
  });
  const jsonBlob = new Blob([JSON.stringify([headers, ...data], null, 2)], {
    type: 'application/json',
  });
  addDocument(newFileId, fileName, jsonBlob);

  // create new file object to dashboard
  const datetime = new Date().toLocaleString();
  const fileEntry = FileSystemTools.createFile(fileName, newFileId);
  const docEntry = FileSystemTools.addMetadata(fileEntry, {
    created_on: datetime,
  });
  const succeeded = FileSystemTools.addEntry(docEntry, state.getParentFolder());
  if (succeeded) {
    newFileTile.setAttribute('id', fileName);
    updateDashboard();
    return true;
  } else {
    newFileTile.remove();
    return false;
  }
}

/**
 * Renames current selection of document on dashboard, updating the database for files
 *
 * @param entry IEntry to rename
 */
function renameEntry(entry: IEntry, newName: string) {
  const succeeded = FileSystemTools.renameEntry(
    entry,
    state.getParentFolder(),
    newName,
  );
  if (succeeded) {
    // Update database if entry is a file
    if (entry.type === 'file') {
      const file = entry as IFile;
      updateDocName(file.id, newName).then(() => {
        updateDashboard();
      });
    } else {
      updateDashboard();
    }
  }
}

/**
 * Given an entry id, returns the entry from the current folder
 *
 * @param id
 * @returns IEntry
 */
function getEntryById(id: string): IEntry {
  const targetEntry = state.getEntries().find((entry) => {
    return entry.id === id;
  });
  return targetEntry;
}

/**
 * Reflects changes in file system in dashboard UI
 *
 * @param newPath If provided, uses this path to update dashboard. Otherwise, uses current path.
 */
export async function updateDashboard(newPath?: IFolder[]): Promise<void> {
  if (!newPath) newPath = state.getFolderPath();
  state.setFolderPath(newPath);
  const currentFolder = state.getParentFolder();
  // clear content and selection
  documentsContainer.innerHTML = '';
  shiftSelection.reset();

  // update ordered items for current fs-contents
  state.setEntries(currentFolder.children);

  // populate folder contents
  currentFolder.children.forEach(async (entry, index) => {
    const tile = createTile(entry);
    documentsContainer.appendChild(tile);
    await addTileEventListener(index, entry, tile);
  });

  updateActionBarButtons();
  updateNavPath();
  updateFSButtons();

  const infoBadge = document.getElementById('info-badge');
  if (state.isInTrash()) {
    infoBadge.textContent = 'Files will be deleted after 30 days';
    infoBadge.style.background = '#EFBBCF';
  } else {
    infoBadge.textContent = '';
    infoBadge.style.background = '';
  }

  // add drag and drop listeners for current folder content
  currentFolder.children.forEach((entry) => {
    const tile = document.getElementById(entry.id);
    addDragStartListener(tile);

    if (entry.type === 'folder' || entry.type === 'trash') {
      addDropTargetListeners(tile, currentFolder, entry as IFolder);
    }
  });

  fsm.setFileSystem(state.getFolderPath().at(0));

  // View-all entry point: only at the root level, alongside the top-level
  // folders. Opens a self-managed overlay (see openAllMappings) rather than
  // navigating the FileSystem tree, because foreign mappings come from GitHub
  // storage and are not nodes in the IFolder tree.
  if (state.getFolderPath().length === 1) {
    appendAllMappingsEntry();
  }
}

function addDragStartListener(elem: Element) {
  elem.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    currentDragTarget = e.target;
  });
}

function addDropTargetListeners(
  elem: Element,
  currentFolder: IFolder,
  destinationFolder: IFolder,
) {
  /**
   * The dragenter and dragover events need to be overriden in order to implement the drag-and-drop functionality.
   * Read more at: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations
   */
  elem.addEventListener('dragenter', (e) => {
    e.preventDefault();
    elem.classList.add('dragenter');
  });
  elem.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elem.classList.remove('dragenter');
  });
  elem.addEventListener('dragover', (e) => e.preventDefault());

  elem.addEventListener(
    'drop',
    createHandleDrop(currentFolder, destinationFolder),
  );
}

function createHandleDrop(currentFolder: IFolder, destinationFolder: IFolder) {
  return (e: Event) => {
    e.preventDefault();

    // get the ID of the element being dragged
    const dragTargetID = (<HTMLElement>currentDragTarget).getAttribute('id');

    // Using dragTargetID, find the object that represents the File being dropped.
    const dragEntry = getEntryById(dragTargetID);

    // If folder, destination, and file were found, move the file into the folder. Great success!
    // Make sure that a folder is not being dropped into the same folder.
    if (dragEntry && dragEntry !== destinationFolder) {
      moveToFolder([dragEntry], currentFolder, destinationFolder);
    }
  };
}

/**
 * Checks if entry can be moved to newFolder, and if so, moves it and refreshes dashboard.
 *
 * @param entry
 * @param parentFolder
 * @param newFolder
 */
function moveToFolder(
  entries: IEntry[],
  parentFolder: IFolder,
  newFolder: IFolder,
) {
  const errorMessages = [];
  entries.forEach((entry) => {
    // Handle name conflicts for trash folder
    if (
      newFolder.type === 'trash' &&
      newFolder.children.some((e) => e.name === entry.name)
    ) {
      entry.name = trashFNConflictHandler(entry.name);
    }
    const response = FileSystemTools.canMoveEntry(
      entry,
      parentFolder,
      newFolder,
    );
    if (!response.succeeded) errorMessages.push(response.error);
    else {
      FileSystemTools.moveEntry(entry, parentFolder, newFolder);
      // Keep the GitHub remote in step with trash moves. This is centralized
      // here (rather than in each caller) because EVERY move -- button Put
      // Back, drag-and-drop, Move-To menu, Send to Trash -- funnels through
      // moveToFolder. Doing it per-handler missed the drag path entirely.
      // Files only; best-effort & fire-and-forget (local move is source of
      // truth for the UI, remote sync follows without blocking).
      syncRemoteForMove(entry, parentFolder, newFolder);
    }
  });

  errorMessages.filter((msg, idx, arr) => arr.indexOf(msg) === idx);
  if (errorMessages.length > 0) window.alert(errorMessages.join('\n'));

  updateDashboard();
}

/**
 * Mirror a local trash move onto the GitHub remote. Called for every entry that
 * moveToFolder successfully moves. Direction is inferred from the folders:
 *   - moved INTO trash      -> trashRemote   (file -> .trash/ on GitHub)
 *   - moved OUT of trash     -> restoreRemote (.trash/ -> top level)
 *   - any other move (folder<->folder) -> no remote effect (flat remote).
 * Only file entries map to the remote. The remote key is the file's ORIGINAL
 * bare name, so we strip any " - <datetime>" suffix that trash-collision
 * renaming may have appended. No-ops when logged out (inside trash/restore).
 */
function syncRemoteForMove(
  entry: IEntry,
  fromFolder: IFolder,
  toFolder: IFolder,
) {
  if (entry.type !== EntryType.File) return;

  const movedIntoTrash = toFolder.type === EntryType.Trash;
  const movedOutOfTrash = fromFolder.type === EntryType.Trash;
  if (!movedIntoTrash && !movedOutOfTrash) return;

  const TRASH_SUFFIX =
    / - \d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [APMapm]{2}$/;
  const bareName = entry.name.replace(TRASH_SUFFIX, '');
  const remotePath = nameToPath(bareName);
  const storage = getMappingStorage();

  if (movedIntoTrash) {
    storage
      .trashRemote(remotePath)
      .catch((err) =>
        console.error(`trashRemote failed for "${bareName}":`, err),
      );
  } else {
    storage
      .restoreRemote(remotePath)
      .catch((err) =>
        console.error(`restoreRemote failed for "${bareName}":`, err),
      );
  }
}

function trashFNConflictHandler(filename: string): string {
  const datetime = new Date().toLocaleString();
  return filename + ' - ' + datetime;
}

/**
 * Opens Move-To menu modal window with UI for moving selected entries to a new folder.
 */
function openMoveToWindow() {
  // generate modal window
  const modalWindow = new ModalWindow();
  modalWindow.setModalWindowView(ModalWindowView.MOVE_TO);
  modalWindow.openModalWindow();

  const selectedEntries = state.getSelectedEntries();
  const parentFolder = state.getParentFolder();

  // Callback for when user double-clicks on a folder and moves selection
  const moveToCallback = (newParentFolder: IFolder) => {
    modalWindow.hideModalWindow();
    moveToFolder(selectedEntries, parentFolder, newParentFolder);
  };

  const rootTree = generateRootTree(moveToCallback);
  const treeContainer = document.createElement('div');
  treeContainer.classList.add('tree-container');
  treeContainer.appendChild(rootTree);

  const modalContainer = document.getElementById(
    'cress-modal-window-content-container',
  );
  modalContainer.innerHTML =
    '<span class="move-menu-msg">Double-click the folder you want to move your items to!</span>';
  modalContainer.appendChild(treeContainer);
}

/**
 * Opens New Folder menu modal window that prompts for a name.
 * On clicking the Create button, closes modal window and creates new folder.
 */
function openNewFolderWindow() {
  if (!newFolderButton.classList.contains('active')) return;

  // generate modal window
  const modalWindow = new ModalWindow();
  modalWindow.setModalWindowView(ModalWindowView.NEW_FOLDER);
  modalWindow.openModalWindow();

  const inputContainer = document.getElementById(
    'dashboard_input_container',
  ) as HTMLDivElement;
  const cancelButton = document.getElementById(
    'cancel_dashboard',
  ) as HTMLButtonElement;
  const confirmButton = document.getElementById(
    'confirm_dashboard',
  ) as HTMLButtonElement;

  const input = document.createElement('input');
  input.id = 'dashboard_input';
  input.type = 'text';
  input.placeholder = 'Untitled Folder';
  input.value = 'Untitled Folder';
  inputContainer.appendChild(input);

  input.select();
  input.focus();

  cancelButton.addEventListener('click', () => modalWindow.hideModalWindow());
  confirmButton.addEventListener('click', () =>
    confirmNewFolderAction(modalWindow, input.value),
  );

  inputContainer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      modalWindow.hideModalWindow();
    } else if (event.key === 'Enter') {
      confirmNewFolderAction(modalWindow, input.value);
    }
  });
}

/**
 * Opens New Empty File menu modal window that prompts for a name.
 * On clicking the Create button, closes modal window and creates a new empty file.
 */
function openNewFileWindow() {
  if (!newFileButton.classList.contains('active')) return;

  // generate modal window
  const modalWindow = new ModalWindow();
  modalWindow.setModalWindowView(ModalWindowView.NEW_FILE);
  modalWindow.openModalWindow();

  const inputContainer = document.getElementById(
    'dashboard_input_container',
  ) as HTMLDivElement;
  const cancelButton = document.getElementById(
    'cancel_dashboard',
  ) as HTMLButtonElement;
  const confirmButton = document.getElementById(
    'confirm_dashboard',
  ) as HTMLButtonElement;

  // Create input field for file name
  const fileNameInput = document.createElement('input');
  fileNameInput.id = 'dashboard_input';
  fileNameInput.type = 'text';
  fileNameInput.placeholder = 'Untitled File';
  fileNameInput.value = 'Untitled File';
  // label for file name
  const fileNameLabel = document.createElement('label');
  fileNameLabel.htmlFor = 'dashboard_input';
  fileNameLabel.innerText = 'File Name:';
  inputContainer.appendChild(fileNameLabel);
  inputContainer.appendChild(fileNameInput);

  fileNameInput.select();
  fileNameInput.focus();

  // Create input field for number of rows
  const rowNumInput = document.createElement('input');
  rowNumInput.id = 'dashboard_input';
  rowNumInput.type = 'number';
  rowNumInput.min = '1';
  rowNumInput.max = '100';
  rowNumInput.value = '10';
  // label for number of rows
  const rowNumLabel = document.createElement('label');
  rowNumLabel.htmlFor = 'dashboard_input';
  rowNumLabel.innerText = 'Number of Rows:';
  inputContainer.appendChild(rowNumLabel);
  inputContainer.appendChild(rowNumInput);

  cancelButton.addEventListener('click', () => modalWindow.hideModalWindow());
  confirmButton.addEventListener('click', () =>
    confirmNewFileAction(
      modalWindow,
      fileNameInput.value,
      parseInt(rowNumInput.value),
    ),
  );

  inputContainer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      modalWindow.hideModalWindow();
    } else if (event.key === 'Enter') {
      confirmNewFileAction(
        modalWindow,
        fileNameInput.value,
        parseInt(rowNumInput.value),
      );
    }
  });
}

function confirmNewFolderAction(modalWindow: ModalWindow, folderName: string) {
  if (!nameExists(folderName)) {
    modalWindow.hideModalWindow();
    handleAddFolder(folderName);
  } else {
    window.alert('The folder name already exists in the current folder!');
    openNewFolderWindow();
  }
}

function confirmNewFileAction(
  modalWindow: ModalWindow,
  fileName: string,
  rowNum: number,
) {
  if (!nameExists(fileName)) {
    modalWindow.hideModalWindow();
    handleAddFile(fileName, rowNum);
  } else {
    window.alert('The file name already exists in the current folder!');
    openNewFileWindow();
  }
}

/**
 * Opens Rename menu modal window that prompts for a new name.
 */
function openRenameWindow() {
  // generate modal window
  const modalWindow = new ModalWindow();
  modalWindow.setModalWindowView(ModalWindowView.RENAME);
  modalWindow.openModalWindow();

  const inputContainer = document.getElementById(
    'dashboard_input_container',
  ) as HTMLDivElement;
  const cancelButton = document.getElementById(
    'cancel_dashboard',
  ) as HTMLButtonElement;
  const confirmButton = document.getElementById(
    'confirm_dashboard',
  ) as HTMLButtonElement;

  const input = document.createElement('input');
  input.id = 'dashboard_input';
  input.type = 'text';
  const prevName = state.getSelectedEntries()[0].name;
  input.placeholder = prevName;
  input.value = prevName;
  inputContainer.appendChild(input);

  input.select();
  input.focus();

  cancelButton.addEventListener('click', () => modalWindow.hideModalWindow());
  confirmButton.addEventListener('click', () =>
    confirmRenameAction(modalWindow, input.value, prevName),
  );

  inputContainer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      modalWindow.hideModalWindow();
    } else if (event.key === 'Enter') {
      confirmRenameAction(modalWindow, input.value, prevName);
    }
  });
}

// On confirmation, close modal window and rename entry (if file, database is updated)
function confirmRenameAction(
  modalWindow: ModalWindow,
  newName: string,
  prevName: string,
) {
  // check for duplicated names
  if (newName === prevName) {
    modalWindow.hideModalWindow();
  } else {
    if (!nameExists(newName)) {
      modalWindow.hideModalWindow();
      const entry = state.getSelectedEntries()[0];
      renameEntry(entry, newName);
    } else {
      window.alert('The filename already exists in the current folder!');
      openRenameWindow();
    }
  }
}

function nameExists(name: string): boolean {
  const parent = state.getParentFolder();
  return parent.children.some((e) => e.name === name);
}

/**
 * Recursive function to generate folder tree structure for move-to menu
 *
 * @param folder IFolder to generate tree structure for and all its subfolders
 * @param callback Callback function for when user double-clicks on a folder and moves selection
 * @param degree The level of subfolders deep
 * @returns List item node
 */
function generateFolderTree(
  folder: IFolder,
  moveToCallback: (newParentFolder: IFolder) => void,
  degree: number,
): HTMLLIElement {
  const tree = document.createElement('li');
  // container for folder name and arrow
  const liContainer = document.createElement('div');
  liContainer.classList.add('tree-li-container');

  // Folder TEXT: click to select (for UX), double click to move items to folder
  const folderName = document.createElement('div');
  folderName.classList.add('tree-name');
  folderName.innerHTML = folder.name;

  // On single click, highlight/select folder name
  folderName.addEventListener('click', () => {
    document
      .querySelectorAll('.tree-name')
      .forEach((elem) => elem.classList.remove('selected'));
    folderName.classList.add('selected');
  });

  // On double click, move selected items to folder
  folderName.addEventListener('dblclick', () => {
    moveToCallback(folder);
  });

  // If Folder has no subfolders, return without nested ul
  const isLeaf = folder.children.every((entry) => entry.type !== 'folder');
  if (isLeaf) {
    tree.appendChild(liContainer);
    liContainer.appendChild(folderName);
    return tree;
  }
  // Otherwise Folder is not empty, make tree structure

  // Unordered LIST (hiding or unhiding li)
  const ul = document.createElement('ul');

  // ARROW
  const arrow = document.createElement('div');
  arrow.classList.add('tree-arrow');
  arrow.innerHTML = '▶';

  // if more than ... subfolders down, hide by default
  if (degree < 2) ul.classList.add('active');
  if (degree < 2) arrow.classList.add('active');

  arrow.addEventListener('click', () => {
    arrow.classList.toggle('active');
    ul.classList.toggle('active');
  });

  tree.appendChild(liContainer);
  liContainer.appendChild(arrow);
  liContainer.appendChild(folderName);
  tree.appendChild(ul);

  // Append folder contents
  folder.children.forEach((entry) => {
    if (entry.type === 'folder') {
      const folderTree = generateFolderTree(
        entry as IFolder,
        moveToCallback,
        degree + 1,
      );
      ul.appendChild(folderTree);
    }
  });
  return tree;
}

/**
 * Generates entire file system folder tree for move-to menu
 *
 * @param moveToCallback callback function for when user double-clicks on a folder and moves selection
 * @returns
 */
function generateRootTree(
  moveToCallback: (newParentFolder: IFolder) => void,
): HTMLUListElement {
  const rootTree = document.createElement('ul');
  rootTree.id = 'tree-root';
  rootTree.appendChild(generateFolderTree(state.root(), moveToCallback, 0));
  return rootTree;
}

/**
 * Displays dashboard context menu with the appropriate content
 *
 * @param view context menu view (determines content of context menu)
 */
function showContextMenu(view: string, clientX: number, clientY: number) {
  switch (view) {
    // Context menu options when files/folders are right-clicked
    case 'selection-options':
      // Need to determine selection category before displaying options
      const numberOfSelectedFiles = state.getSelectedFiles().length;
      const numberOfSelectedFolders = state.getSelectedFolders().length;
      const selectedTrash = state.getSelectedTrash().length;

      /**
       * Context menu options conditions:
       *    1) 1 file -> open, move to trash, move
       *    2) 2+ files -> open, move to trash, move
       *    3) file(s) + folder(s) -> move to trash, move
       *    4) 1 folder -> open, move to trash, move
       *    5) 2+ folders -> move to trash, move
       *    6) trash -> empty trash
       *    7) entry in trash -> put back, delete
       */

      // trash
      if (!numberOfSelectedFiles && !numberOfSelectedFolders && selectedTrash) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.trashFolderOptions;
        setContextMenuItemsEventListeners('trash-folder-options');
      } else if (
        state.getFolderPath().length > 1 &&
        state.getFolderPath().at(1).name == 'Trash'
      ) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.trashEntryOptions;
        setContextMenuItemsEventListeners('trash-entry-options');
      }
      // 1 file
      else if (
        numberOfSelectedFiles === 1 &&
        !numberOfSelectedFolders &&
        !selectedTrash
      ) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.singleFileOptions;
        setContextMenuItemsEventListeners('single-file-options');
      }
      // 2+ files
      else if (
        numberOfSelectedFiles > 1 &&
        !numberOfSelectedFolders &&
        !selectedTrash
      ) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.multiFileOptions;
        setContextMenuItemsEventListeners('multi-file-options');
      }
      // file(s) + folder(s)
      else if (
        numberOfSelectedFiles >= 1 &&
        numberOfSelectedFolders >= 1 &&
        !selectedTrash
      ) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.folderAndFileOptions;
        setContextMenuItemsEventListeners('folder-and-file-options');
      }
      // 1 folder
      else if (
        !numberOfSelectedFiles &&
        numberOfSelectedFolders === 1 &&
        !selectedTrash
      ) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.singleFolderOptions;
        setContextMenuItemsEventListeners('single-folder-options');
      }
      // 2+ folders
      else if (
        !numberOfSelectedFiles &&
        numberOfSelectedFolders > 1 &&
        !selectedTrash
      ) {
        contextMenuContentWrapper.innerHTML =
          contextMenuContent.multiFolderOptions;
        setContextMenuItemsEventListeners('multi-folder-options');
      }
      break;

    // Default context menu (righ-clicking on dashboard background)
    default:
      contextMenuContentWrapper.innerHTML = contextMenuContent.defaultOptions;
      setContextMenuItemsEventListeners('default');
  }

  // disable editor menu for the samples folder and trash
  if (
    state.getParentFolder().metadata['immutable'] ||
    (state.getSelectedEntries()[0] &&
      state.getSelectedEntries()[0].metadata['immutable']) ||
    state.isInTrash()
  ) {
    const deleteBtn = document.getElementById('cm-remove-btn');
    const renameBtn = document.getElementById('cm-rename-btn');
    const moveBtn = document.getElementById('cm-move-btn');
    const updateDocBtn = document.getElementById('cm-upload-doc-btn');
    const newFolderBtn = document.getElementById('cm-new-folder-btn');
    const newFileBtn = document.getElementById('cm-new-file-btn');

    if (deleteBtn) {
      deleteBtn.classList.add('disabled');
    }
    if (renameBtn) {
      renameBtn.classList.add('disabled');
    }
    if (moveBtn) {
      moveBtn.classList.add('disabled');
    }
    if (updateDocBtn) {
      updateDocBtn.classList.add('disabled');
    }
    if (newFolderBtn) {
      newFolderBtn.classList.add('disabled');
    }
    if (newFileBtn) {
      newFileBtn.classList.add('disabled');
    }
  }

  // get the position of the user's mouse
  contextMenu.style.left = `${clientX}px`;
  contextMenu.style.top = `${clientY}px`;

  // display context menu
  contextMenu.classList.remove('hidden');
}

/**
 * Set event listeners for the menu items in a particular context menu.
 *
 * @param view The name of the context menu view that is being displayed.
 */
function setContextMenuItemsEventListeners(view: string) {
  // All the buttons that will have events attached to them have the same classname.
  const btnClassname = 'context-menu-item-wrapper';

  switch (view) {
    case 'single-file-options':
      // "Open" menu item
      document
        .querySelector(`.${btnClassname}#cm-open-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openDocsHandler();
        });

      // "Move to Trash" menu item
      document
        .querySelector(`.${btnClassname}#cm-remove-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          removeDocsHandler();
        });

      // "Rename" menu item
      document
        .querySelector(`.${btnClassname}#cm-rename-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openRenameWindow();
        });

      // "Move" menu item
      document
        .querySelector(`.${btnClassname}#cm-move-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openMoveToWindow();
        });

      break;

    case 'multi-file-options':
      // "Open" menu item
      document
        .querySelector(`.${btnClassname}#cm-open-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openDocsHandler();
        });

      // "Move to Trash" menu item
      document
        .querySelector(`.${btnClassname}#cm-remove-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          removeDocsHandler();
        });

      // "Move" menu item
      document
        .querySelector(`.${btnClassname}#cm-move-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openMoveToWindow();
        });

      break;

    case 'folder-and-file-options':
      // "Move to Trash" menu item
      document
        .querySelector(`.${btnClassname}#cm-remove-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          removeDocsHandler();
        });

      // "Move" menu item
      document
        .querySelector(`.${btnClassname}#cm-move-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openMoveToWindow();
        });

      break;

    case 'single-folder-options':
      // "Open" menu item
      document
        .querySelector(`.${btnClassname}#cm-open-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openDocsHandler();
        });

      // "Move to Trash" menu item
      document
        .querySelector(`.${btnClassname}#cm-remove-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          removeDocsHandler();
        });

      // "Rename" menu item
      document
        .querySelector(`.${btnClassname}#cm-rename-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openRenameWindow();
        });

      // "Move" menu item
      document
        .querySelector(`.${btnClassname}#cm-move-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openMoveToWindow();
        });

      break;

    case 'multi-folder-options':
      // "Move to Trash" menu item
      document
        .querySelector(`.${btnClassname}#cm-remove-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          removeDocsHandler();
        });

      // "Move" menu item
      document
        .querySelector(`.${btnClassname}#cm-move-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openMoveToWindow();
        });

      break;

    case 'trash-folder-options':
      // "Empty Trash" menu item
      document
        .querySelector(`.${btnClassname}#cm-empty-trash-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          emptyTrashHandler();
        });

      break;

    case 'trash-entry-options':
      // "Put Back" menu item
      document
        .querySelector(`.${btnClassname}#cm-recover-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          putBackDocsHandler();
        });

      // "Delete" menu item
      document
        .querySelector(`.${btnClassname}#cm-delete-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          deleteDocsHandler();
        });

      break;

    default:
      // "Upload document" menu item
      document
        .querySelector(`.${btnClassname}#cm-upload-doc-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openUploadAreaHandler();
        });

      // "New folder" menu item
      document
        .querySelector(`.${btnClassname}#cm-new-folder-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openNewFolderWindow();
        });

      // "New file" menu item
      document
        .querySelector(`.${btnClassname}#cm-new-file-btn`)
        .addEventListener('click', (_e) => {
          contextMenu.classList.add('hidden');
          openNewFileWindow();
        });
  }
}

/**
 * Initialize dashboard context menu (right click menu).
 * This will set up all necessary event listeners as well as
 * the logic to determine the content of the context menu, which
 * may change depending on where the user right-clicks (file, files, folder, background, etc.)
 */
function initializeDefaultContextMenu() {
  // right-click on dashboard background
  document
    .querySelector('.main-section')
    .addEventListener('contextmenu', (e) => {
      e.preventDefault();

      unselectAll();

      showContextMenu(
        'default',
        (<MouseEvent>e).clientX,
        (<MouseEvent>e).clientY,
      );
    });

  document.querySelector('.main-section').addEventListener('click', (_e) => {
    contextMenu.classList.add('hidden');
  });
}

/**
 * Add listeners for specific context menus.
 * Specific context menus appear when user right-clicks on selected files/folders.
 * The actual menu that is shown depends on the type of selection.
 */
function addSpecificContextMenuListeners(tile, index) {
  // right-click on folder item (file or folder)
  tile.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (rightClicked || state.getSelectedEntries().length === 1) {
      unselectAll();
    }

    // select
    select(index);

    showContextMenu(
      'selection-options',
      (<MouseEvent>e).clientX,
      (<MouseEvent>e).clientY,
    );
    contextMenu.classList.remove('hidden');
    rightClicked = true;
  });

  // hide context menu if user clicks away
  mainSection.addEventListener('click', (e) => {
    if (rightClicked) {
      let clickedElement = e.target as HTMLElement;
      if (clickedElement.parentElement.classList.contains('document-entry')) {
        clickedElement = clickedElement.parentElement;
      }

      contextMenu.classList.add('hidden');
      rightClicked = false;
      if (!clickedElement.classList.contains('document-entry')) {
        // if clicks on blank
        unselectAll();
      } else {
        // if clicks on a file/folder, select it
        const clickedEntry = getEntryById(clickedElement.id);
        shiftSelectionHandler(state.getIndexByEntryName(clickedEntry.name));
      }
    }
  });
}

/**
 * Update the Trash folder by deleting entries that were deleted 30 days ago
 */
function updateTrash(root: IFolder): void {
  if (!state.getTrashFolder()) {
    fsm.newTrash(root);
  }
  const trashFolder = state.getTrashFolder();
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(
    currentDate.getTime() - 30 * 24 * 60 * 60 * 1000,
  ); // 30 days in milliseconds

  // Helper function to check if an entry was deleted 30 days ago
  const toDelete = (entry: IEntry): boolean => {
    if (entry.metadata && entry.metadata['removed_on']) {
      const date = new Date(entry.metadata['removed_on'] as string);
      return date <= thirtyDaysAgo;
    }
    return false;
  };

  // Iterate through the entries in the Trash
  trashFolder.children.forEach((entry) => {
    if (toDelete(entry)) {
      // Delete entry if deleted 30 days ago
      if (entry.type === 'file') {
        deleteFileEntry(entry as IFile, trashFolder);
      } else if (entry.type === 'folder') {
        deleteFolderEntry(entry as IFolder, trashFolder);
      }
    }
  });
}

/**
 * Loads root folder into dashboard on startup.
 */
export const loadDashboard = async (): Promise<void> => {
  const root = await fsm.getRoot();
  state.root(root);
  updateTrash(root);
  updateDashboard([root]);
  initializeDefaultContextMenu();
};

/* ==========================================================================
 * View-all ("All Mappings") — Version C
 *
 * A self-managed overlay panel, deliberately isolated from the FileSystem
 * navigation tree (state.getFolderPath()). Foreign mappings come from GitHub
 * storage, not from the IFolder tree, so wiring them into folderPath / the
 * breadcrumb / Back would mean threading a "is this node foreign?" exception
 * through the whole navigation core. Instead this panel shows/hides itself over
 * the normal dashboard (the same idea as the trash info-badge, scaled up to a
 * whole view) and has its own Back button.
 *
 * Your own files render as normal editable tiles at the top. Each other user is
 * a row that expands/collapses in place to reveal their files as read-only
 * tiles with a "Copy to my mappings" action.
 * ======================================================================== */

const ALL_MAPPINGS_ENTRY_ID = 'all-mappings-entry';
const ALL_MAPPINGS_PANEL_ID = 'all-mappings-panel';

/**
 * Append the "All Mappings" entry tile to the root view, styled like the other
 * top-level folder cards. Idempotent: removes any prior copy first so repeated
 * updateDashboard calls don't stack duplicates.
 */
function appendAllMappingsEntry(): void {
  document.getElementById(ALL_MAPPINGS_ENTRY_ID)?.remove();

  const tile = document.createElement('div');
  tile.classList.add('document-entry', 'folder-entry');
  tile.setAttribute('id', ALL_MAPPINGS_ENTRY_ID);

  const icon = document.createElement('img');
  icon.classList.add('document-icon');
  icon.src = './Cress-gh/assets/img/folder-icon.svg';

  const name = document.createElement('div');
  name.innerText = 'All Mappings';

  tile.appendChild(icon);
  tile.appendChild(name);
  tile.addEventListener('dblclick', openAllMappings, false);

  documentsContainer.appendChild(tile);
}

/**
 * Show the view-all panel over the dashboard. Reuses the dashboard's own Back
 * button (#fs-back-btn) and breadcrumb (#nav-path-container) rather than drawing
 * its own, so navigation looks identical to the rest of the app. The panel
 * itself only renders the file lists. Built lazily on first open, then
 * repopulated each time so the list reflects the latest login / remote state.
 */
async function openAllMappings(): Promise<void> {
  let panel = document.getElementById(ALL_MAPPINGS_PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.setAttribute('id', ALL_MAPPINGS_PANEL_ID);
    // Stop clicks inside the panel from bubbling to backgroundArea's click
    // handler, which calls updateFSButtons() and would reset our borrowed Back
    // button (leaving the user stranded with a disabled Back).
    panel.addEventListener('click', (e) => e.stopPropagation());
    // Sit on top of the normal dashboard content area.
    backgroundArea.appendChild(panel);
  }
  panel.innerHTML = '';
  panel.style.display = 'block';
  // Hide the normal file grid while the panel is open; keep the breadcrumb
  // (#fs-top-zone) and Back button (#fs-middle-zone) visible and reuse them.
  documentsContainer.style.display = 'none';

  // Extend the breadcrumb to read "Home / All Mappings" (folderPath is still
  // [root] since we didn't navigate the tree).
  const crumb = document.getElementById('nav-path-container');
  if (crumb && !document.getElementById('all-mappings-crumb')) {
    const sep = document.createElement('div');
    sep.classList.add('nav-path-seperator');
    sep.innerHTML = ' / ';
    sep.setAttribute('id', 'all-mappings-crumb-sep');
    const seg = document.createElement('div');
    seg.classList.add('nav-path-section');
    seg.setAttribute('id', 'all-mappings-crumb');
    seg.innerText = 'All Mappings';
    crumb.appendChild(sep);
    crumb.appendChild(seg);
  }

  const body = document.createElement('div');
  body.classList.add('all-mappings-body');
  panel.appendChild(body);

  await populateAllMappings(body);

  // Activate the Back button LAST, after any rendering that might have rebuilt
  // it, so nothing overwrites the active state. We keep the same node (no
  // clone/replace) to avoid dangling the dashboard's own backButton reference.
  activatePanelBackButton();
}

/**
 * Turn the dashboard's Back button into the panel's close control: active
 * colour (opacity 100%, like entering Samples), clickable, and wired to
 * closeAllMappings. Idempotent — safe to call repeatedly.
 */
function activatePanelBackButton(): void {
  const back = document.getElementById('fs-back-btn') as HTMLButtonElement;
  if (!back) return;
  back.classList.add('active');
  back.removeAttribute('disabled');
  back.removeEventListener('click', closeAllMappings);
  back.addEventListener('click', closeAllMappings);
}

/**
 * Hide the panel and restore the normal dashboard: show the file grid again,
 * strip the "All Mappings" breadcrumb segment, detach our Back listener, and
 * rebuild the dashboard. updateDashboard -> updateBackButton fully owns the
 * Back button's colour/disabled state afterwards (it disables + greys it at the
 * root), so we must NOT set those here or we'd fight that logic.
 */
function closeAllMappings(): void {
  const panel = document.getElementById(ALL_MAPPINGS_PANEL_ID);
  if (panel) panel.style.display = 'none';
  documentsContainer.style.display = '';
  document.getElementById('all-mappings-crumb-sep')?.remove();
  document.getElementById('all-mappings-crumb')?.remove();

  const back = document.getElementById('fs-back-btn') as HTMLButtonElement;
  if (back) back.removeEventListener('click', closeAllMappings);

  // Rebuild at the current (root) path; updateBackButton resets the Back button
  // to its correct root state (disabled, grey) and re-appends the entry tile.
  void updateDashboard(state.getFolderPath());
}

/**
 * Fill the panel body: the current user's own files (editable) up top, then a
 * row per foreign user that expands in place. Failures degrade to a message
 * rather than throwing, so a missing index / logged-out state just shows less.
 */
async function populateAllMappings(body: HTMLElement): Promise<void> {
  const loading = document.createElement('div');
  loading.classList.add('all-mappings-hint');
  loading.innerText = 'Loading…';
  body.appendChild(loading);

  let foreignUsers: string[] = [];
  try {
    foreignUsers = await listIndexedForeignUsers();
  } catch (err) {
    console.error('listIndexedForeignUsers failed:', err);
  }

  loading.remove();

  // Section: your own files (editable), pulled from the FileSystem root so it
  // matches exactly what "My Mappings" shows.
  const ownHint = document.createElement('div');
  ownHint.classList.add('all-mappings-hint');
  ownHint.innerText = 'Your files — click any file to open and edit.';
  body.appendChild(ownHint);

  const ownGrid = document.createElement('div');
  ownGrid.classList.add('all-mappings-grid');
  body.appendChild(ownGrid);
  renderOwnFilesInto(ownGrid);

  // Section: other people's mappings.
  const foreignHint = document.createElement('div');
  foreignHint.classList.add('all-mappings-hint');
  foreignHint.innerText = foreignUsers.length
    ? "Other people's mappings — open a user to view (read only):"
    : 'No other users found.';
  body.appendChild(foreignHint);

  foreignUsers.forEach((user) => body.appendChild(createForeignUserRow(user)));
}

/**
 * Render the current user's own files as normal editable tiles into a grid.
 * Reads the FileSystem root's file children directly (same source as the main
 * dashboard) so behaviour and appearance match "My Mappings".
 */
function renderOwnFilesInto(grid: HTMLElement): void {
  const root = state.getFolderPath().at(0);
  if (!root) return;
  root.children
    .filter((entry: IEntry) => entry.type === EntryType.File)
    .forEach((entry: IEntry) => {
      const tile = createTile(entry);
      // In the panel we don't want drag/selection semantics; a double-click to
      // open is enough and matches My Mappings.
      tile.setAttribute('draggable', 'false');
      tile.addEventListener('dblclick', () => openFile(entry as IFile), false);
      grid.appendChild(tile);
    });
}

/**
 * A collapsible row for one foreign user. Collapsed by default; expanding it
 * lazily fetches that user's files and renders them as read-only tiles. This is
 * pure show/hide — no navigation state changes.
 */
function createForeignUserRow(user: string): HTMLElement {
  const row = document.createElement('div');
  row.classList.add('foreign-user-row');

  const header = document.createElement('div');
  header.classList.add('foreign-user-header');

  const chevron = document.createElement('span');
  chevron.classList.add('foreign-user-chevron');
  chevron.innerText = '▸';

  const label = document.createElement('span');
  label.classList.add('foreign-user-name');
  label.innerText = user;

  header.appendChild(chevron);
  header.appendChild(label);
  row.appendChild(header);

  const filesWrap = document.createElement('div');
  filesWrap.classList.add('foreign-user-files');
  filesWrap.style.display = 'none';
  row.appendChild(filesWrap);

  let loaded = false;
  header.addEventListener('click', async (e) => {
    // Stop the click bubbling to backgroundArea's handler, which calls
    // updateFSButtons() and would reset our borrowed Back button.
    e.stopPropagation();
    const isOpen = filesWrap.style.display !== 'none';
    if (isOpen) {
      filesWrap.style.display = 'none';
      chevron.innerText = '▸';
      activatePanelBackButton();
      return;
    }
    filesWrap.style.display = 'block';
    chevron.innerText = '▾';
    if (!loaded) {
      loaded = true;
      await loadForeignUserFiles(user, filesWrap);
    }
    // Re-assert the panel's Back state: rendering foreign tiles can trigger the
    // dashboard to rebuild its Back button (dropping our active state + close
    // listener), which would otherwise strand the user in the panel.
    activatePanelBackButton();
  });

  return row;
}

/** Fetch and render one user's files as read-only tiles. */
async function loadForeignUserFiles(
  user: string,
  wrap: HTMLElement,
): Promise<void> {
  wrap.innerHTML = '';
  const loading = document.createElement('div');
  loading.classList.add('all-mappings-hint');
  loading.innerText = 'Loading…';
  wrap.appendChild(loading);

  let files: { path: string }[] = [];
  try {
    files = await getMappingStorage().listForeignMappings(user);
  } catch (err) {
    console.error(`listForeignMappings failed for "${user}":`, err);
  }

  loading.remove();

  if (!files.length) {
    const empty = document.createElement('div');
    empty.classList.add('all-mappings-hint');
    empty.innerText = 'No files.';
    wrap.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.classList.add('all-mappings-grid');
  files.forEach((meta) => grid.appendChild(createForeignTile(user, meta.path)));
  wrap.appendChild(grid);
}

/**
 * A read-only tile for a foreign file: white card like your own files (open but
 * not edit — never greyed out), plus a "Copy to my mappings" action.
 * Deliberately has no drag / selection / context-menu behaviour — foreign files
 * are not entries in the FileSystem tree. Read-only is conveyed by context (the
 * file sits inside another user's row, and only offers a copy action), matching
 * how Drive/Finder present others' files without a per-file badge.
 */
function createForeignTile(owner: string, path: string): HTMLElement {
  const tile = document.createElement('div');
  tile.classList.add('document-entry', 'file-entry', 'foreign-tile');
  tile.setAttribute('draggable', 'false');

  const icon = document.createElement('img');
  icon.classList.add('document-icon');
  icon.src = './Cress-gh/assets/img/folio-icon.svg';

  const name = document.createElement('div');
  name.classList.add('foreign-tile-name');
  name.innerText = path;

  const copyBtn = document.createElement('button');
  copyBtn.classList.add('foreign-tile-copy');
  copyBtn.innerText = 'Copy to my mappings';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    void handleCopyForeign(owner, path);
  });

  tile.appendChild(icon);
  tile.appendChild(name);
  tile.appendChild(copyBtn);

  return tile;
}

/**
 * Copy a foreign mapping into the current user's own storage. On a same-name
 * clash the storage layer throws ConflictError; we then offer the Finder-style
 * choice (Replace / Keep both / Cancel). Keep both re-issues the copy with a
 * suggested new name; Replace uses the dedicated overwrite path.
 */
async function handleCopyForeign(owner: string, path: string): Promise<void> {
  const storage = getMappingStorage();
  try {
    await storage.copyForeignMapping(owner, path);
    refreshAllMappingsOwnFiles();
  } catch (err) {
    if (err instanceof ConflictError) {
      showCopyConflictDialog(owner, path);
      return;
    }
    console.error(`copyForeignMapping failed for "${owner}/${path}":`, err);
    window.alert(`Could not copy "${path}".`);
  }
}

/** Suggest a non-colliding name, e.g. "foo" -> "foo copy". */
function suggestCopyName(path: string): string {
  return `${path} copy`;
}

/**
 * Finder-style same-name conflict dialog: Replace / Keep both / Cancel. Built
 * as a lightweight self-contained overlay rather than going through the
 * enum-based ModalWindow (which binds fixed views to fixed template HTML).
 */
function showCopyConflictDialog(owner: string, path: string): void {
  const overlay = document.createElement('div');
  overlay.classList.add('copy-conflict-overlay');

  const box = document.createElement('div');
  box.classList.add('copy-conflict-box');

  const msg = document.createElement('div');
  msg.classList.add('copy-conflict-msg');
  msg.innerText = `You already have a mapping named "${path}". What would you like to do?`;
  box.appendChild(msg);

  const actions = document.createElement('div');
  actions.classList.add('copy-conflict-actions');

  const close = () => overlay.remove();

  const replaceBtn = document.createElement('button');
  replaceBtn.innerText = 'Replace';
  replaceBtn.addEventListener('click', async () => {
    close();
    try {
      await getMappingStorage().copyForeignMappingReplacing(owner, path);
      refreshAllMappingsOwnFiles();
    } catch (err) {
      console.error('Replace copy failed:', err);
      window.alert(`Could not replace "${path}".`);
    }
  });

  const keepBothBtn = document.createElement('button');
  keepBothBtn.innerText = 'Keep both';
  keepBothBtn.addEventListener('click', async () => {
    close();
    const newName = suggestCopyName(path);
    try {
      await getMappingStorage().copyForeignMapping(owner, path, newName);
      refreshAllMappingsOwnFiles();
    } catch (err) {
      if (err instanceof ConflictError) {
        // The suggested name also exists; let the user try again.
        showCopyConflictDialog(owner, path);
        return;
      }
      console.error('Keep-both copy failed:', err);
      window.alert(`Could not copy "${path}".`);
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel';
  cancelBtn.addEventListener('click', close);

  actions.appendChild(replaceBtn);
  actions.appendChild(keepBothBtn);
  actions.appendChild(cancelBtn);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/**
 * A copied file lands in the user's own GitHub/local storage, which is a
 * different source of truth from the FileSystem tree the dashboard renders, so
 * the copy won't appear in the panel's "your files" section without a refresh.
 * For now we just re-render that section's grid from the current tree; a full
 * reconciliation of remote-only files into the tree is a separate concern.
 */
function refreshAllMappingsOwnFiles(): void {
  const panel = document.getElementById(ALL_MAPPINGS_PANEL_ID);
  if (!panel) return;
  const grid = panel.querySelector('.all-mappings-grid');
  if (grid instanceof HTMLElement) {
    grid.innerHTML = '';
    renderOwnFilesInto(grid);
  }
}
