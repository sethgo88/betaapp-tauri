# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Prisma
# running a migration 
update prisma/schema.prisma
run: npx prisma migrate dev --name 

## Rust sqLite
# Migrations
run: sqlx migrate add <migration name>
update migration in src-tauri/migrations
update src-tauri/src/lib.rs migration static strings and any related functions