var Brand = require('../models/brand');
var Model = require('../models/model');
var Feature = require('../models/feature');
var imageFilter = require('../helpers/imageFilter');
var async = require('async');
var path = require('path');

const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
const multer = require('multer');
const mkdirp = require('mkdirp');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../public/uploads/brand');
        mkdirp(dir, err => cb(err, dir));
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    fileFilter: imageFilter.imageFilter
});

exports.index = function(req, res) {
    async.parallel({
        brand_count: function(callback) {
            Brand.countDocuments({}, callback);
        },
        model_count: function(callback) {
            Model.countDocuments({}, callback);
        },
        feature_count: function(callback) {
            Feature.countDocuments({}, callback);
        }
    }, function(err, results) {
        res.render('index', { title: 'Home', error: err, data: results });
    });
};

exports.brand_list = function(req, res) {
    Brand.find({}, 'name founded logo')
        .sort([['name', 'ascending']])
        .exec(function (err, list_brands) {
            if (err) { return next(err); }
            res.render('brand/brand_list', { title: 'brand List', brand_list: list_brands });
        });
};

exports.brand_detail = function(req, res, next) {
    async.parallel({
        brand: function(callback) {
            Brand.findById(req.params.id)
                .exec(callback);
        },

        brand_models: function(callback) {
            Model.find({ 'brand': req.params.id })
                .exec(callback);
        },

    }, function(err, results) {
        if (err) { return next(err); }
        if (results.brand==null) {
            var err = new Error('Brand not found');
            err.status = 404;
            return next(err);
        }
        res.render('brand/brand_detail', { title: 'Brand Detail', brand: results.brand, brand_models: results.brand_models } );
    });
};

exports.brand_create_get = function(req, res) {
    res.render('brand/brand_form', { title: 'Create Brand'});
};

exports.brand_upload_logo_get = function(req, res) {
    Brand.findById(req.params.id)
        .exec(function (err, brand) {
            if (err) { return next(err); }
            if (brand==null) {
                res.redirect('/catalog/brands');
            }
            res.render('brand/brand_logo_form', { title: 'Upload Brand Logo', brand: brand});
        })
};

var logoUpload = upload.single('logo');

exports.brand_upload_logo_post = function(req, res) {
    Brand.findById(req.params.id)
        .exec(function (err, brand) {
            if (err) { return next(err); }
            if (brand==null) {
                res.redirect('/catalog/brands');
            }
            logoUpload(req, res, (err) => {
                if (err) {
                    res.render('brand/brand_logo_form', {title: 'Upload Brand Logo', brand: brand, error: err.message});
                    return;
                }
                brand.logo = req.file.filename;
                brand.save(function (err) {
                    if (err) { return next(err); }
                    res.redirect(brand.url);
                });
            });
        })
};

exports.brand_create_post = [
    upload.none(),
    // Validate fields.
    body('name').isLength({ min: 1 }).trim().withMessage('brand name must be specified.')
        .isAlphanumeric().withMessage('First name has non-alphanumeric characters.'),
    body('founded', 'Invalid date').optional({ checkFalsy: true }).isISO8601(),

    // Sanitize fields.
    sanitizeBody('*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {
        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a genre object with escaped and trimmed data.
        var brand = new Brand(
            {
                name: req.body.name,
                founded: req.body.founded,
            }
        );

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            res.render('brand/brand_form', { title: 'Create Brand', brand: brand, errors: errors.array()});
            return;
        }
        else {
            // Data from form is valid.
            // Check if brand with same name already exists.
            Brand.findOne({ 'name': req.body.name })
                .exec( function(err, found_brand) {
                    if (err) { return next(err); }

                    if (found_brand) {
                        res.redirect(found_brand.url);
                    } else {
                        brand.save(function (err) {
                            if (err) { return next(err); }
                            // brand saved. Redirect to genre detail page.
                            res.redirect(brand.url);
                        });
                    }
                });
        }
    }
];

exports.brand_delete_get = function(req, res, next) {
    async.parallel({
        brand: function(callback) {
            Brand.findById(req.params.id).exec(callback)
        },
        brand_models: function(callback) {
            Model.find({ 'brand': req.params.id }).exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.brand==null) {
            res.redirect('/catalog/brands');
        }
        res.render('brand/brand_delete', { title: 'Delete Brand', brand: results.brand, brand_models: results.brand_models } );
    });
};

exports.brand_delete_post = function(req, res, next) {
    async.parallel({
        brand: function(callback) {
            Brand.findById(req.params.id).exec(callback)
        },
        brand_models: function(callback) {
            Model.find({ 'brand': req.params.id }).exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.brand_models.length > 0) {
            res.render('brand/brand_delete', { title: 'Delete Brand', brand: results.brand, brand_models: results.brand_models } );
            return;
        }
        else {
            Brand.findByIdAndRemove(req.body.brandid, function deleteBrand(err) {
                if (err) { return next(err); }
                res.redirect('/catalog/brands')
            })
        }
    });
};

exports.brand_update_get = function(req, res, next) {
    Brand.findById(req.params.id)
        .exec(function (err, brand) {
            if (err) { return next(err); }
            if (brand==null) {
                res.redirect('/catalog/brands');
            }
            res.render('brand/brand_form', { title: 'Update Brand', brand: brand});
        })
};

exports.brand_update_post = [

    body('name').isLength({ min: 1 }).trim().withMessage('brand name must be specified.')
        .isAlphanumeric().withMessage('First name has non-alphanumeric characters.'),
    body('founded', 'Invalid date').optional({ checkFalsy: true }).isISO8601(),

    sanitizeBody('*').escape(),

    (req, res, next) => {

        const errors = validationResult(req);

        var brand = new Brand(
            {
                name: req.body.name,
                founded: req.body.founded,
                _id: req.params.id //This is required, or a new ID will be assigned!
            }
        );


        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            res.render('brand/brand_form', { title: 'Create Brand', brand: brand, errors: errors.array()});
            return;
        }
        else {

            Brand.findByIdAndUpdate(req.params.id, brand, {}, function (err, updateBrand) {
                if (err) { return next(err); }
                res.redirect(updateBrand.url);
            });
        }
    }
];