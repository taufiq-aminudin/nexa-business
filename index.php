<?php
session_start();
require __DIR__.'/src/bootstrap.php';
$page=$_GET['page']??'dashboard';
if($page==='login'){require __DIR__.'/src/login.php';exit;} if($page==='logout'){session_destroy(); header('Location: ?page=login'); exit;}
$allowed=['dashboard','missions','companies','contacts','leads','opportunities','campaigns','inbox','tasks','documents','properties','vendors','content','automations','integrations','settings','audit'];
if(!in_array($page,$allowed,true))$page='dashboard';
$action=$_GET['action']??'';if($action){require __DIR__.'/src/actions.php';handle_action($action);}require __DIR__.'/src/layout.php';
