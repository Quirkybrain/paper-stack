//! Trusted Rust services. wp-08 ships the authorization core (`paths`,
//! `auth`), wp-10 the document/read core (`files`, `tree`), wp-11 the SQLite
//! storage and session services, wp-12 the watch/single-instance services
//! (`watch`, `app`) and wp-13 the remote resource policy (`resources`);
//! wp-14 adds the diagnostics and application-info services.

pub mod app;
pub mod auth;
pub mod diagnostics;
pub mod files;
pub mod info;
pub mod paths;
pub mod resources;
pub mod session;
pub mod storage;
pub mod tree;
pub mod watch;
