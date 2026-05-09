pub mod git;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Create the menu items
            let new_tab = MenuItemBuilder::new("New Tab")
                .id("new_tab")
                .accelerator("CmdOrCtrl+T")
                .build(app)?;
            let close_tab = MenuItemBuilder::new("Close Tab")
                .id("close_tab")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;
            let reopen_tab = MenuItemBuilder::new("Reopen Closed Tab")
                .id("reopen_tab")
                .accelerator("Shift+CmdOrCtrl+T")
                .build(app)?;
            let clone_repo = MenuItemBuilder::new("Clone Repo")
                .id("clone_repo")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let init_repo = MenuItemBuilder::new("Init Repo")
                .id("init_repo")
                .accelerator("CmdOrCtrl+I")
                .build(app)?;
            let open_repo = MenuItemBuilder::new("Open Repo")
                .id("open_repo")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let open_repo_external = MenuItemBuilder::new("Open Repo in External Editor")
                .id("open_repo_external")
                .accelerator("Shift+CmdOrCtrl+E")
                .build(app)?;
            let open_terminal = MenuItemBuilder::new("Open External Terminal")
                .id("open_terminal")
                .accelerator("CmdOrCtrl+Shift+T")
                .build(app)?;
            let open_file_manager = MenuItemBuilder::new("Open in File Manager")
                .id("open_file_manager")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;
            let sign_in = MenuItemBuilder::new("Sign into a Different Account")
                .id("sign_in")
                .build(app)?;

            // Create the 'File' submenu
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&new_tab)
                .item(&close_tab)
                .item(&reopen_tab)
                .separator()
                .item(&clone_repo)
                .item(&init_repo)
                .item(&open_repo)
                .item(&open_repo_external)
                .separator()
                .item(&open_terminal)
                .item(&open_file_manager)
                .separator()
                .item(&sign_in)
                .build()?;

            // Create the main menu
            let menu = MenuBuilder::new(app).item(&file_submenu).build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                app.emit("menu-event", event.id().0.clone()).ok();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
