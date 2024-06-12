import { ModalWindowView } from './utils/ModalWindow';

export interface ModalWindowInterface {
  setModalWindowView(view: ModalWindowView): void;
  openModalWindow(): void;
  hideModalWindow(): void;
}
