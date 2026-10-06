//! Trusted Rust services. wp-08 ships the authorization core (`paths`,
//! `auth`), wp-10 the document/read core (`files`, `tree`);
//! storage/watch/remote/diagnostics services follow in later work packages.

pub mod auth;
pub mod files;
pub mod paths;
pub mod tree;
