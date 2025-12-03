import { redirect } from 'next/navigation'
import { getProduct, getCategories } from '@dragon/api'
import { BuyButton } from '@/components/BuyButton'
import { AddToCartButton } from '@/components/AddToCartButton'
import Link from 'next/link'

interface ProductPageProps {
  params: {
    slug: string
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProduct(params.slug)
  const categories = await getCategories()

  if (!product) {
    redirect('/products')
  }

  if (!product.isActive) {
    redirect('/products')
  }

  const productCategory = product.categoryId > 0 
    ? categories.find(cat => cat.id === product.categoryId)
    : null

  const price = (product.price / 100).toFixed(2)
  
  let imageUrl = '/placeholder-product.jpg'
  if (product.images) {
    try {
      const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images
      if (Array.isArray(images) && images.length > 0) {
        imageUrl = images[0]
      } else if (typeof images === 'string') {
        imageUrl = images
      }
    } catch {
      if (typeof product.images === 'string') {
        imageUrl = product.images
      }
    }
  }

  return (
    <div className="max-w-[650px] mx-auto bg-white min-h-screen pb-24">
      {/* Product Header with Gradient Background */}
      <div className="pro_content relative mb-16" style={{
        backgroundImage: 'linear-gradient(130deg, #00F5B2, #1FC3FF, #00dbde)',
        height: '120px',
        backgroundSize: '300%',
        animation: 'bganimation 10s infinite'
      }}>
        <style jsx>{`
          @keyframes bganimation {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
        <div className="list_item_box absolute top-14 left-0 right-0 px-4">
          <div className="bor_detail flex gap-4">
            <div className="thumb w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-white shadow-lg">
              <img
                src={imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="pro_right flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white bg-black bg-opacity-30 px-2 py-1 rounded">
                  Regular Price
                </span>
                <div className="flex gap-2">
                  <Link href="/" className="icon-home bg-[#0079fa] text-white p-2 rounded-full shadow-md">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </Link>
                </div>
              </div>
              <div className="list_item_title text-white font-bold text-lg mb-2 line-clamp-2">
                {product.name}
              </div>
              {productCategory && (
                <div className="mb-2">
                  <Link 
                    href={`/products?categorySlug=${productCategory.slug}`}
                    className="text-xs text-white bg-black bg-opacity-30 px-2 py-1 rounded hover:bg-opacity-50"
                  >
                    {productCategory.name}
                  </Link>
                </div>
              )}
              <div className="list_tag">
                <div className="price">
                  <span className="t_price text-white">
                    Price: <span className="pay_price font-bold text-lg">${price}</span>
                  </span>
                  {product.stock !== null && (
                    <div className="stock text-white text-xs mt-1">
                      Remaining: <span className="quota font-bold">{product.stock}</span> pieces
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Form Section */}
      <div className="px-4">
        <div className="text-center text-base font-semibold mb-4">Fill in order information</div>
        
        <div className="space-y-4">
          {/* Email Input */}
          <div className="layui-form-item">
            <label className="block text-sm font-medium mb-2">Email Address:</label>
            <input
              type="email"
              id="customer_email"
              className="w-full px-4 py-2 bg-gray-100 rounded-lg border-none outline-none"
              placeholder="Enter your email"
            />
          </div>

          {/* Quantity Selector */}
          <div className="layui-form-item">
            <label className="block text-sm font-medium mb-2">
              Quantity:
              {product.stock !== null && (
                <span className="float-right text-red-600">
                  Remaining: <span className="font-bold">{product.stock}</span> pieces
                </span>
              )}
            </label>
            <div className="input-group flex">
              <div
                id="num_min"
                className="input-group-addon bg-[#ff7100] text-white px-4 py-2 rounded-l cursor-pointer select-none"
              >
                -1
              </div>
              <input
                id="num"
                type="number"
                min="1"
                max={product.stock || undefined}
                defaultValue={product.minQuantity}
                className="flex-1 text-center font-bold border border-gray-300 px-2 bg-gray-100"
                required
              />
              <div
                id="num_add"
                className="input-group-addon bg-[#ff7100] text-white px-4 py-2 rounded-r cursor-pointer select-none"
              >
                +1
              </div>
            </div>
          </div>

          {/* Price Display */}
          <div className="layui-form-item">
            <label className="block text-sm font-medium mb-2">Product Price</label>
            <input
              type="text"
              id="need"
              disabled
              className="w-full text-center text-[#4169E1] bg-white border border-gray-300 px-4 py-2 rounded"
              value={`$${price}`}
            />
            <div className="text-[#ff7100] text-xs mt-1">
              When increasing or decreasing quantity, please note the price change~
            </div>
          </div>
        </div>

        {/* Product Description */}
        <div className="content_friends border border-green-500 rounded-lg mt-8 mb-24">
          <div className="top_tit bg-green-500 text-white px-4 py-2 font-semibold rounded-t-lg">
            Product Description
          </div>
          <div
            className="hd_intro p-4 break-words prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: product.description || 'No description available'
            }}
          />
        </div>
      </div>

      {/* Fixed Footer with Buttons */}
      <div className="assemble-footer footer fixed bottom-0 left-0 right-0 max-w-[650px] mx-auto bg-white bg-opacity-70 z-50 border-t">
        <div className="aui-footer-flex flex items-center h-14">
          {/* Back Button */}
          <div className="aui-footer-wrap w-[30%] h-14">
            <Link
              href="/products"
              className="h-full flex flex-col items-center justify-center text-gray-700 hover:text-gray-900"
            >
              <span className="text-lg mb-1">←</span>
              <span className="text-xs">Back</span>
            </Link>
          </div>

          {/* Cart and Buy Now Buttons */}
          <div className="aui-footer-group flex-1 h-14 flex gap-2">
            <div className="flex-1">
              <AddToCartButton product={product} className="h-full text-sm" />
            </div>
            <div className="flex-1">
              <BuyButton product={product} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
