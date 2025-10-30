// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};
use sqlx::{migrate::MigrateDatabase, prelude::FromRow, sqlite::SqlitePoolOptions, Pool, Sqlite};
use tauri::{App, Manager as _};

type Db = Pool<Sqlite>;

struct AppState {
    db: Db,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            add_climb,
            get_climbs,
        ])
        .setup(|app| {
            tauri::async_runtime::block_on(async move {
                let db = setup_db(&app).await;
 
                app.manage(AppState { db });
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn setup_db(app: &App) -> Db {
    let mut path = app.path().app_data_dir().expect("failed to get data_dir");
    println!("Database path: {:?}", path);
    match std::fs::create_dir_all(path.clone()) {
        Ok(_) => {}
        Err(err) => {
            panic!("error creating directory {}", err);
        }
    };

    path.push("db.sqlite");

    Sqlite::create_database(
        format!(
            "sqlite:{}",
            path.to_str().expect("path should be something")
        )
        .as_str(),
    )
    .await
    .expect("failed to create database");

    let db = SqlitePoolOptions::new()
        .connect(path.to_str().unwrap())
        .await
        .unwrap();

    sqlx::migrate!("./migrations").run(&db).await.unwrap();

    db
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
enum SentStatus {
    Project,
    Sent,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
struct Climb {
    id: Option<i64>,
    name: String,
    route_type: String,
    grade: String,
    moves: String,
    created_date: i64,
    last_update_date: i64,
    link: Option<String>,
    route_location: Option<String>,
    country: Option<String>,
    area: Option<String>,
    sub_area: Option<String>,
    sent_status: SentStatus,
}

#[tauri::command]
async fn get_climbs(state: tauri::State<'_, AppState>) -> Result<Vec<Climb>, String> {
    let db = &state.db;

    let climbs: Vec<Climb> = sqlx::query_as::<_, Climb>("SELECT * FROM climbs")
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get climbs {}", e))?;

    Ok(climbs)
}

#[tauri::command]
async fn add_climb(state: tauri::State<'_, AppState>, climb: Climb) -> Result<(), String> {
    let db = &state.db;

    sqlx::query(
        "INSERT INTO climbs (
            name, route_type, grade, moves, created_date, last_update_date, link, route_location, country, area, sub_area, sent_status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    )
        .bind(climb.name)
        .bind(climb.route_type)
        .bind(climb.grade)
        .bind(climb.moves)
        .bind(climb.created_date)
        .bind(climb.last_update_date)
        .bind(climb.link)
        .bind(climb.route_location)
        .bind(climb.country)
        .bind(climb.area)
        .bind(climb.sub_area)
        .bind(climb.sent_status)
        .execute(db)
        .await
        .map_err(|e| format!("Error saving climb: {}", e))?;

    Ok(())
}
