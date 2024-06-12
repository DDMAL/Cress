/**
 * HTML for Hotkeys modal window
 */
export const hotkeysModal = `
    <div class="neon-modal-window-content" id="neon-modal-window-content-hotkeys">
        <!-- "Display" hotkeys -->
        <div class="hotkey-subcategory-container">
            <div class="hotkey-subcategory-title">Display</div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Shift</div>
                    <div>+</div>
                    <div class="hotkey-entry">+</div>
                </div>
                <div class="hotkey-entry-description">Zoom In</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Shift</div>
                    <div>+</div>
                    <div class="hotkey-entry">-</div>
                </div>
                <div class="hotkey-entry-description">Zoom Out</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">0</div>
                </div>
                <div class="hotkey-entry-description">Zoom Reset</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">h</div>
                </div>
                <div class="hotkey-entry-description">Hide Glyph</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Shift</div>
                    <div>+</div>
                    <div class="hotkey-entry">T</div>
                </div>
                <div class="hotkey-entry-description">Scroll To Syllable Text</div>
            </div>
        </div>

        <!-- "Edit" hotkeys -->
        <div class="hotkey-subcategory-container">
            <div class="hotkey-subcategory-title">Edit</div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Ctrl</div>
                    <div>+</div>
                    <div class="hotkey-entry">z</div>
                    <div>or</div>
                    <div class="hotkey-entry">⌘</div>
                    <div>+</div>
                    <div class="hotkey-entry">z</div>
                </div>
                <div class="hotkey-entry-description">Undo</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Ctrl</div>
                    <div>+</div>
                    <div class="hotkey-entry">Shift</div>
                    <div>+</div>
                    <div class="hotkey-entry">z</div>
                    <div>or</div>
                    <div class="hotkey-entry">⌘</div>
                    <div>+</div>
                    <div class="hotkey-entry">Shift</div>
                    <div>+</div>
                    <div class="hotkey-entry">z</div>
                </div>
                <div class="hotkey-entry-description">Redo</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">q/w/e/r/t/y</div>
                </div>
                <div class="hotkey-entry-description">
                    Highlight by Staff/Syllable/Neume/LayerElement/Selection/Off
                </div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">1/2/3/4/5/6</div>
                </div>
                <div class="hotkey-entry-description">
                    Select by Syllable/Neume/Neume Component/Staff/Layer Element/BBox
                </div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Shift</div>
                    <div>+</div>
                    <div class="hotkey-entry">Number</div>
                </div>
                <div class="hotkey-entry-description">
                    Begin Insert for the <i>nth</i> option in the selected tab
                </div>
            </div>
        </div>

        <!-- "Other" hotkeys -->
        <div class="hotkey-subcategory-container">
            <div class="hotkey-subcategory-title">Other</div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">s</div>
                </div>
                <div class="hotkey-entry-description">Save File</div>
            </div>
            <div class="hotkey-entry-container">
                <div class="hotkey-container">
                    <div class="hotkey-entry">Esc</div>
                </div>
                <div class="hotkey-entry-description">Return to Edit Mode</div>
            </div>
        </div>
    </div>`;

export const errorLogsPanelContents = `<div class="panel-heading" id="errorLogHeading">
        <div class="panel-heading-title">Error Log</div>
        <svg class="icon">
            <use id="toggleErrorLog" xlink:href="${__ASSET_PREFIX__}/assets/img/icons.svg#dropdown-down"></use>
        </svg>
    </div>
    <div class="panel-contents" id="errorLogContents" style="overflow: scroll; padding: 0.5em 0.75em; max-height: 300px;"><div>`;
