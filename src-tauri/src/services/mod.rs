//! Trusted Rust services. wp-08 ships the authorization core (`paths`,
//! `auth`), wp-10 the document/read core (`files`, `tree`), wp-11 the SQLite
//! storage and session services, wp-12 the watch/single-instance services
//! (`watch`, `app`) and wp-13 the remote resource policy (`resources`);
//! diagnostics follow in later work packages.

pub mod app;
pub mod auth;
pub mod files;
pub mod paths;
pub mod resources;
pub mod session;
pub mod storage;
pub mod tree;
pub mod watch;
