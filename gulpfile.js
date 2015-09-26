var gulp = require('gulp');
var mocha = require('gulp-mocha');

var paths = {
    src: 'src/*.js',
    test: 'test/*.js'
};

gulp.task('default', ['test']);

gulp.task('test', function () {
    return gulp.src('test/*.js', {read: false})
        .pipe(mocha({reporter: 'spec'}));
});

gulp.task('watch', function () {
    gulp.watch(paths.src, ['test']);
    gulp.watch(paths.test, ['test']);
});
