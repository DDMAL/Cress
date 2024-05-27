import CressView from '../CressView';
import { ModalWindowView } from './ModalWindow';

async function setBody (cressView: CressView): Promise<void> {

  const response = await fetch(`${__ASSET_PREFIX__}assets/template.html`);
  document.body.innerHTML = await response.text();
  (<HTMLImageElement> document.getElementById('cress-main-icon')).src = `${__LINK_LOCATION__}favicon.png`;
  Array.from(document.getElementsByClassName('external-link-icon')).forEach((el) => {
    (<HTMLImageElement> el).src = `${__ASSET_PREFIX__}assets/img/external-link.svg`;
  });

  document.getElementById('filename').innerText = cressView.name;
  document.title = cressView.name;
  
  // hotkey btn onclick event listener
  // document.getElementById('navbar-item-hotkeys').addEventListener('click', function() {
  //   cressView.modal.setModalWindowView(ModalWindowView.HOTKEYS);
  //   cressView.modal.openModalWindow();
  // });

  // set initial saved status
  const indicator = document.querySelector<HTMLDivElement>('#file-saved');
  indicator.setAttribute('src', `${__ASSET_PREFIX__}assets/img/saved-icon.svg`);
  indicator.setAttribute('alt', 'Your work is saved');
}

export { setBody as default };
