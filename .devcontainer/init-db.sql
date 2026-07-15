-- devcontainer 初回起動時(空ボリューム時のみ)にアプリ別 DB を作成。
-- 既存ボリュームでは実行されないため、post-create.sh の create-app-dbs.mjs が冪等に補完する。
CREATE DATABASE app_crud;
CREATE DATABASE app_equipment;
