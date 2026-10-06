//! Trusted Rust services. wp-08 ships the authorization core (`paths`,
//! `auth`), wp-10 the document/read core (`files`, `tree`), wp-11 the SQLite
//! storage and session services; watch/remote/diagnostics follow in later
//! work packages.

pub mod auth;
pub mod files;
pub mod paths;
pub mod session;
pub mod storage;
pub mod tree;
