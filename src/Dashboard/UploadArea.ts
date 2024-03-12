import { ModalWindow, ModalWindowView } from '../utils/ModalWindow';
import { IFolder } from './FileSystem';



export function InitUploadArea(currentFolder: IFolder): void {
  // generate modal window
  const modalWindow = new ModalWindow();
  modalWindow.setModalWindowView(ModalWindowView.DOCUMENT_UPLOAD);
  modalWindow.openModalWindow();
}