// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};
use sqlx::{migrate::MigrateDatabase, prelude::FromRow, sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::time::{SystemTime, UNIX_EPOCH};
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
            update_climb,
            delete_climb,
            get_user,
            add_user,
            update_user
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

    // Run migrations at runtime
    run_migrations(&db).await.expect("Failed to run migrations");

    db
}

async fn run_migrations(db: &Db) -> Result<(), String> {
    // Create migrations table if it doesn't exist
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _sqlx_migrations (
            version BIGINT PRIMARY KEY,
            description TEXT NOT NULL,
            installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            success BOOLEAN NOT NULL,
            execution_time BIGINT NOT NULL
        )"
    )
    .execute(db)
    .await
    .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    let migrations: &[(&str, &str)] = &[
        ("20251105035844_add_commas.sql", include_str!("../migrations/20251105035844_add_commas.sql")),
        ("20260208045737_user_create_date.sql", include_str!("../migrations/20260208045737_user_create_date.sql")),
        ("20260208191541_user_first_last.sql", include_str!("../migrations/20260208191541_user_first_last.sql")),
        ("20260208204353_user_last_name.sql", include_str!("../migrations/20260208204353_user_last_name.sql")),
        ("20260209031105_cleanup_users_table.sql", include_str!("../migrations/20260209031105_cleanup_users_table.sql")),
    ];

    for (file_name, sql) in migrations {
        let version: i64 = file_name
            .split('_')
            .next()
            .and_then(|v| v.parse().ok())
            .ok_or_else(|| format!("Invalid migration filename: {}", file_name))?;

        let already_applied: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM _sqlx_migrations WHERE version = ?1"
        )
        .bind(version)
        .fetch_one(db)
        .await
        .map_err(|e| format!("Failed to check migration status: {}", e))?;

        if already_applied.0 > 0 {
            println!("Migration {} already applied, skipping", file_name);
            continue;
        }

        println!("Running migration: {}", file_name);
        sqlx::query(sql)
            .execute(db)
            .await
            .map_err(|e| format!("Failed to execute migration {}: {}", file_name, e))?;

        sqlx::query(
            "INSERT INTO _sqlx_migrations (version, description, success, execution_time) VALUES (?1, ?2, ?3, ?4)"
        )
        .bind(version)
        .bind(file_name)
        .bind(true)
        .bind(0i64)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to record migration: {}", e))?;
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
struct Climb {
    id: String,
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
    sent_status: String,
    synced: Option<String>
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
struct User {
    id: String,
    email: Option<String>,
    synced: Option<String>,
    date_added: Option<i64>
}

#[tauri::command]
async fn get_climbs(state: tauri::State<'_, AppState>) -> Result<Vec<Climb>, String> {
    let db = &state.db;

    let climbs: Vec<Climb> = sqlx::query_as::<_, Climb>("SELECT * FROM climbs")
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get climbs {}", e))?;

    println!("grabbing climb: {:?}", climbs);
    Ok(climbs)
}

#[tauri::command]
async fn add_climb(state: tauri::State<'_, AppState>, climb: Climb) -> Result<Vec<Climb>, String> {
    let db = &state.db;

    println!("Adding climb: {:?}", climb);
    sqlx::query(
        "INSERT INTO climbs (
            id, name, route_type, grade, moves, created_date, last_update_date, link, route_location, country, area, sub_area, sent_status, synced
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)"
    )
        .bind(climb.id.clone())
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
        .bind(climb.synced)
        .execute(db)
        .await
        .map_err(|e| format!("Error saving climb: {}", e))?;
        
        let climb: Vec<Climb> = sqlx::query_as::<_, Climb>("SELECT * FROM climbs WHERE id = ?1")
        .bind(climb.id.clone())
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get climbs {}", e))?;

    Ok(climb)
}

#[tauri::command]
async fn update_climb(state: tauri::State<'_, AppState>, climb: Climb) -> Result<Vec<Climb>, String> {
    let db = &state.db;
    println!("Updating climb: {:?}", climb);
    sqlx::query("UPDATE climbs SET name = ?1, route_type = ?2, grade = ?3, moves = ?4, last_update_date = ?5, link = ?6, route_location = ?7, country = ?8, area = ?9, sub_area = ?10, sent_status = ?11, synced = ?12 WHERE id = ?13")
        .bind(climb.name)
        .bind(climb.route_type)
        .bind(climb.grade)
        .bind(climb.moves)
        .bind(climb.last_update_date)
        .bind(climb.link)
        .bind(climb.route_location)
        .bind(climb.country)
        .bind(climb.area)
        .bind(climb.sub_area)
        .bind(climb.sent_status)
        .bind(climb.synced)
        .bind(climb.id.clone())
        .execute(db)
        .await
        .map_err(|e| format!("could not update climb {}", e))?;

    let climb: Vec<Climb> = sqlx::query_as::<_, Climb>("SELECT * FROM climbs WHERE id = ?1")
        .bind(climb.id.clone())
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get climbs {}", e))?;

    Ok(climb)
}

#[tauri::command]
async fn delete_climb(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let db = &state.db;

    sqlx::query("DELETE FROM climbs WHERE id = ?1")
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("could not delete climb {}", e))?;

    Ok(())
}

#[tauri::command]
async fn get_user(state: tauri::State<'_, AppState>) -> Result<Vec<User>, String> {
    let db = &state.db;

    let user: Vec<User> = sqlx::query_as::<_, User>("SELECT * FROM users")
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get user {}", e))?;

    println!("grabbing user: {:?}", user);
    Ok(user)
}

#[tauri::command]
async fn add_user(state: tauri::State<'_, AppState>, user: User) -> Result<Vec<User>, String> {
    let db = &state.db;

    println!("Adding user: {:?}", user);
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {}", e))?
        .as_secs() as i64;

    sqlx::query(
        "INSERT INTO users (
            id, email, synced, date_added
        ) VALUES (?1, ?2, ?3, ?4)"
    )
        .bind(user.id.clone())
        .bind(user.email)
        .bind(user.synced)
        .bind(now)
        .execute(db)
        .await
        .map_err(|e| format!("Error saving user: {}", e))?;
        
        let user: Vec<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?1")
        .bind(user.id.clone())
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get user {}", e))?;

    Ok(user)
}

#[tauri::command]
async fn update_user(state: tauri::State<'_, AppState>, user: User) -> Result<Vec<User>, String> {
    let db = &state.db;
    println!("Updating user: {:?}", user);
    sqlx::query("UPDATE users SET email = ?1, synced = ?2 WHERE id = ?3")
        .bind(user.email)
        .bind(user.synced)
        .bind(user.id.clone())
        .execute(db)
        .await
        .map_err(|e| format!("could not update user {}", e))?;

    let user: Vec<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?1")
        .bind(user.id.clone())
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get user {}", e))?;

    Ok(user)
}
