<?php
$config=require __DIR__.'/../config.php';
date_default_timezone_set($config['timezone']);
require __DIR__.'/db.php';
require __DIR__.'/helpers.php';
require __DIR__.'/ai.php';
$data=db(); init_db($data);
if(!isset($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(16));
$public_pages=['login','logout'];
$public_actions=['login','logout'];
if(!isset($_SESSION['authenticated']) && !in_array($_GET['page']??'', $public_pages,true) && !in_array($_GET['action']??'', $public_actions,true)){ redirect('?page=login'); }
