<?php
// POST → courses are no longer sold on this website: Walnut LMS sells them now, and /academy/ lists them
// with their Enrol links. Answers 410 Gone so an old checkout page still open in a browser says where to
// go instead. Payments already started here are still confirmed by verify-payment.php.
declare(strict_types=1);
require __DIR__ . '/lib.php';

respond(410, ['ok' => false, 'error' => 'Courses are now sold on Walnut LMS. Please enrol from https://walnutdatatech.com/academy/.']);
