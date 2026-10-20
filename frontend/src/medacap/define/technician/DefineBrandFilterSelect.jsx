import PortalBrandLogo from '../../../components/PortalBrandLogo.jsx'
import DefineFilterSelect from './DefineFilterSelect.jsx'

function BrandOptionLogo({ brandId }) {
  const slotClass = brandId === 'all'
    ? 'define-tech-brand-select-logo-slot'
    : `define-tech-brand-select-logo-slot define-tech-brand-select-logo-slot--${brandId}`

  return (
    <span className={slotClass} aria-hidden={brandId === 'all'}>
      {brandId !== 'all' ? (
        <PortalBrandLogo
          brand={brandId}
          size="chip"
          className="define-tech-brand-select-logo"
        />
      ) : null}
    </span>
  )
}

export default function DefineBrandFilterSelect(props) {
  return (
    <DefineFilterSelect
      {...props}
      variant="brand"
      listAriaLabel={props.t.medacap_define_filter_brand_lbl}
      renderLeading={opt => <BrandOptionLogo brandId={opt.value} />}
    />
  )
}
