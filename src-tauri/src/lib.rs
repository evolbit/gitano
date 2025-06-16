mod git;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Crea los items del menú
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

            // Crea el submenu 'File'
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

            // Crea el menú principal
            let menu = MenuBuilder::new(app).item(&file_submenu).build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                app.emit("menu-event", event.id().0.clone()).ok();
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            git::open_local_repo,
            git::get_branches,
            git::get_commits,
            git::get_commit_graph,
            git::get_remote_branches,
            git::get_formatted_commits
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
